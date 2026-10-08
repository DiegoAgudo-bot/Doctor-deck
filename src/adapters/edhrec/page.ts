import { z } from "zod";
import type { CardRecommendation, ThemeLink } from "@/domain/recommendations/types";
import { EdhrecError } from "./errors";

/*
 * Estructura (no oficial) de json.edhrec.com/pages/commanders/{slug}.json que usamos:
 *   container.json_dict.card            → datos del comandante (num_decks)
 *   container.json_dict.cardlists[]     → { header, tag, cardviews[] }
 *   cardview                            → { name, synergy, num_decks, inclusion, potential_decks, label }
 *   panels.taglinks[]                   → temas { value, slug, count }
 *   o bien { redirect: "/commanders/otro-slug" }
 * Todo lo demás se ignora. Si cambia esta forma, solo hay que tocar este fichero.
 */

const num = z.number().finite();

const cardviewSchema = z.looseObject({
  name: z.string().min(1),
  synergy: num.nullish(),
  num_decks: num.nullish(),
  inclusion: num.nullish(),
  potential_decks: num.nullish(),
  label: z.string().nullish(),
});

const cardlistSchema = z.looseObject({
  header: z.string().nullish(),
  tag: z.string().nullish(),
  cardviews: z.array(cardviewSchema),
});

const themeSchema = z.looseObject({
  value: z.string(),
  slug: z.string().nullish(),
  href: z.string().nullish(),
  count: num.nullish(),
});

const pageSchema = z.looseObject({
  container: z.looseObject({
    json_dict: z.looseObject({
      card: z.looseObject({ num_decks: num.nullish() }).nullish(),
      cardlists: z.array(cardlistSchema).min(1),
    }),
  }),
  panels: z
    .looseObject({
      taglinks: z.array(themeSchema).nullish(),
    })
    .nullish(),
});

const redirectSchema = z.object({
  redirect: z.string().regex(/^\/commanders\/[a-z0-9-]+(\/[a-z0-9-]+)?$/),
});

export interface ParsedPage {
  totalDecks: number | null;
  themes: ThemeLink[];
  cards: CardRecommendation[];
}

export type PageOrRedirect =
  { kind: "page"; page: ParsedPage } | { kind: "redirect"; path: string };

/** Interpreta el cuerpo de una página de EDHREC. Lanza EdhrecError("format") si no encaja. */
export function parseEdhrecPage(body: string, url?: string): PageOrRedirect {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new EdhrecError("format", "EDHREC no ha devuelto JSON válido", url);
  }

  const redirect = redirectSchema.safeParse(json);
  if (redirect.success) return { kind: "redirect", path: redirect.data.redirect };

  const parsed = pageSchema.safeParse(json);
  if (!parsed.success) {
    throw new EdhrecError(
      "format",
      `La respuesta de EDHREC no tiene la estructura esperada (¿ha cambiado su formato?):\n${z.prettifyError(parsed.error)}`,
      url,
    );
  }
  const { container, panels } = parsed.data;

  const byName = new Map<string, CardRecommendation>();
  for (const list of container.json_dict.cardlists) {
    const category = list.tag ?? list.header ?? "unknown";
    for (const cv of list.cardviews) {
      const prev = byName.get(cv.name);
      if (prev) {
        if (!prev.categories.includes(category)) prev.categories.push(category);
        continue;
      }
      byName.set(cv.name, toRecommendation(cv, category));
    }
  }
  const cards = [...byName.values()];

  const potential = cards.map((c) => c.potentialDecks ?? 0);
  const totalDecks =
    container.json_dict.card?.num_decks ??
    (potential.length > 0 ? Math.max(...potential) || null : null);

  const themes: ThemeLink[] = (panels?.taglinks ?? []).flatMap((t) => {
    const slug = t.slug ?? t.href?.split("/").filter(Boolean).pop() ?? null;
    return slug ? [{ slug, name: t.value, count: t.count ?? null }] : [];
  });

  return { kind: "page", page: { totalDecks, themes, cards } };
}

function toRecommendation(
  cv: z.infer<typeof cardviewSchema>,
  category: string,
): CardRecommendation {
  const numDecks = cv.num_decks ?? cv.inclusion ?? null;
  const potentialDecks = cv.potential_decks ?? null;
  let inclusion: number | null = null;
  if (numDecks !== null && potentialDecks) inclusion = numDecks / potentialDecks;
  else {
    const m = /(\d+(?:\.\d+)?)\s*%\s*of/i.exec(cv.label ?? "");
    if (m?.[1]) inclusion = Number(m[1]) / 100;
  }
  return {
    name: cv.name,
    synergy: cv.synergy ?? null,
    inclusion: inclusion === null ? null : Math.min(1, Math.max(0, inclusion)),
    numDecks,
    potentialDecks,
    categories: [category],
  };
}
