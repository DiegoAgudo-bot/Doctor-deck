import { z } from "zod";
import type { Combo, ComboBracketTag } from "@/domain/combos/types";

/** Lo que se ve de una "variant" de Spellbook (tolerante: el resto de campos se ignora). */
const variant = z.object({
  id: z.string(),
  uses: z.array(
    z.object({
      card: z.object({ name: z.string(), oracleId: z.string().nullish() }),
      mustBeCommander: z.boolean().optional(),
    }),
  ),
  requires: z.array(z.object({ template: z.object({ name: z.string() }) })).default([]),
  produces: z
    .array(z.object({ feature: z.object({ name: z.string(), status: z.string().optional() }) }))
    .default([]),
  bracketTag: z.string().nullish(),
  manaValueNeeded: z.number().nullish(),
  popularity: z.number().nullish(),
});

const response = z.object({
  next: z.string().nullish(),
  results: z.object({
    included: z.array(variant),
    almostIncluded: z.array(variant),
  }),
});

const TAGS: readonly ComboBracketTag[] = ["R", "S", "P", "O", "C", "E", "B"];
/** Lo que produce de verdad (sin las ayudas internas de Spellbook: "Helper", "Utility"). */
const VISIBLE = new Set(["S", "C", undefined]);

function toCombo(v: z.infer<typeof variant>): Combo {
  return {
    id: v.id,
    cards: v.uses.map((u) => ({
      oracleId: u.card.oracleId ?? null,
      name: u.card.name,
      mustBeCommander: u.mustBeCommander ?? false,
    })),
    produces: v.produces.filter((p) => VISIBLE.has(p.feature.status)).map((p) => p.feature.name),
    requires: v.requires.map((r) => r.template.name),
    bracketTag: TAGS.find((t) => t === v.bracketTag) ?? null,
    manaValueNeeded: v.manaValueNeeded ?? 0,
    popularity: v.popularity ?? null,
  };
}

/** Interpreta la respuesta de /find-my-combos. null si no tiene la forma esperada. */
export function parseFindMyCombos(
  body: unknown,
): { included: Combo[]; almostIncluded: Combo[]; complete: boolean } | null {
  const r = response.safeParse(body);
  if (!r.success) return null;
  return {
    included: r.data.results.included.map(toCombo),
    almostIncluded: r.data.results.almostIncluded.map(toCombo),
    complete: !r.data.next,
  };
}
