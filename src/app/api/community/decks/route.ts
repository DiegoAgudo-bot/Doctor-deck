import { z } from "zod";
import { BrowserCollectionRepository } from "@/adapters/memory/anonymous";
import { browseCommunity } from "@/application/community";
import { normalizeIdentity } from "@/domain/deck/facts";
import { getContainer } from "@/server/container";
import { deckSummaries } from "@/server/deck-summaries";
import type { CommunityResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { currentUser } from "@/server/session";
import { BODY_LIMIT, readJson } from "@/server/body";
import type { CommunityFilters, PublicDecks } from "@/domain/ports/social";

const schema = z.object({
  filters: z
    .object({
      q: z.string().max(80).optional(),
      /** Identidad exacta: "WR", "C" o "" = incolora. */
      colors: z
        .string()
        .regex(/^[WUBRGCwubrgc]*$/)
        .max(5)
        .optional(),
      bracket: z.number().int().min(2).max(4).optional(),
      following: z.boolean().optional(),
      username: z.string().max(40).optional(),
    })
    .default({}),
  sort: z.enum(["recent", "likes", "owned"]).default("recent"),
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(100).default(24),
  /** Sin sesión: la colección guardada en el navegador, como pares [oracleId, copias]. */
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
});

/**
 * Mazos públicos de la comunidad con filtros y, para cada uno, cuánto tengo y cuánto cuesta lo que
 * falta (con sesión, con mi colección y mis mazos; sin ella, con la colección del navegador).
 */
/**
 * Los mismos mazos públicos, pero `search` pasa por la caché de un minuto (`communityDecks`):
 * cambiar de página u orden no vuelve a cargar 500 mazos con sus cartas.
 */
function cachedSearch(c: ReturnType<typeof getContainer>): PublicDecks {
  const decks = c.publicDecks;
  return Object.assign(Object.create(decks) as PublicDecks, {
    search: async (filters: CommunityFilters, limit: number) =>
      (
        await c.communityDecks.get(JSON.stringify([filters, limit]), () =>
          decks.search(filters, limit),
        )
      ).value,
  });
}

export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const { filters, collection, ...req } = schema.parse(await readJson(request, BODY_LIMIT.large));
    const c = getContainer();
    const [owned, usage] = user
      ? await Promise.all([c.collectionFor(user.id).ownedQuantities(), c.decksFor(user.id).usage()])
      : [await new BrowserCollectionRepository(collection).ownedQuantities(), undefined];
    const { items, total } = await browseCommunity(
      {
        ...req,
        viewerId: user?.id ?? null,
        filters: {
          ...filters,
          ...(filters.colors !== undefined ? { colors: normalizeIdentity(filters.colors) } : {}),
        },
        owned,
        usage,
      },
      { publicDecks: cachedSearch(c), cards: c.cards, follows: c.social, profiles: c.social },
    );
    const decks = items.map((i) => i.deck);
    const [summaries, owners] = await Promise.all([
      deckSummaries(decks, c.cards),
      Promise.all([...new Set(decks.map((d) => d.ownerId))].map((id) => c.social.byId(id))),
    ]);
    const byId = new Map(owners.flatMap((o) => (o ? [[o.id, o] as const] : [])));
    const body: CommunityResponse = {
      total,
      items: items.map((item, i) => {
        const owner = byId.get(item.deck.ownerId);
        return {
          ...summaries[i]!,
          owner: { username: owner?.username ?? null, name: owner?.name ?? "" },
          likes: item.deck.likes,
          liked: item.liked,
          bracket: item.deck.bracket,
          ownership: item.ownership,
        };
      }),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
