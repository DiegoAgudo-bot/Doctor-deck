import { z } from "zod";
import { BrowserCollectionRepository, noSavedDecks } from "@/adapters/memory/anonymous";
import { deckCombos } from "@/application/deck-combos";
import { keyCards } from "@/domain/combos/analysis";
import type { Combo, ComboCard } from "@/domain/combos/types";
import type { Card } from "@/domain/cards/types";
import { withOverrides } from "@/domain/roles/overrides";
import { getContainer } from "@/server/container";
import { cardDTO, type ComboCardDTO, type ComboDTO, type DeckCombosDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { browserRoleEditsSchema, loadRoleEdits, overridesOf } from "@/server/role-edits";
import { currentUser } from "@/server/session";

/** Combos a una carta que se mandan (los primeros, ya ordenados). */
const ONE_AWAY_LIMIT = 60;

const schema = z.object({
  input: z.string().min(1).max(50_000),
  commanders: z.array(z.string().min(1).max(64)).max(2).optional(),
  deckId: z.uuid().optional(),
  useOtherDecks: z.boolean().optional(),
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
  roleEdits: browserRoleEditsSchema,
});

/**
 * Combos del mazo según Commander Spellbook: completos, a una carta (y si esa carta la tengo) y
 * el bracket recalculado con ellos. Va aparte de /api/analyze porque Spellbook tarda unos segundos.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    const { collection, roleEdits, ...req } = schema.parse(await request.json());
    const c = getContainer();
    const result = await deckCombos(req, {
      sources: c.deckSources,
      cards: c.cards,
      collection: user ? c.collectionFor(user.id) : new BrowserCollectionRepository(collection),
      decks: user ? c.decksFor(user.id) : noSavedDecks,
      combos: c.combos,
      classifier: withOverrides(c.classifier, {
        mine: overridesOf(await loadRoleEdits(user?.id ?? null, roleEdits)),
      }),
    });
    if (!result) {
      return Response.json(
        { error: { code: "needs_commander", message: "Elige primero el comandante." } },
        { status: 400 },
      );
    }
    const oneAway = result.oneAway.slice(0, ONE_AWAY_LIMIT);
    const keys = keyCards(result.oneAway, 8);
    const ids = [
      ...[...result.included, ...oneAway.map((o) => o.combo)].flatMap((combo) =>
        combo.cards.flatMap((x) => (x.oracleId ? [x.oracleId] : [])),
      ),
      ...keys.flatMap((k) => (k.card.oracleId ? [k.card.oracleId] : [])),
    ];
    const byId = new Map<string, Card>(
      (await c.cards.findCardsByOracleIds([...new Set(ids)])).map((x) => [x.oracleId, x]),
    );
    const comboCard = (x: ComboCard): ComboCardDTO => {
      const card = x.oracleId ? byId.get(x.oracleId) : undefined;
      return {
        name: x.name,
        card: card ? cardDTO(card) : null,
        mustBeCommander: x.mustBeCommander,
      };
    };
    const combo = (x: Combo): ComboDTO => ({
      ...x,
      cards: x.cards.map(comboCard),
      url: `https://commanderspellbook.com/combo/${encodeURIComponent(x.id)}/`,
    });
    const body: DeckCombosDTO = {
      included: result.included.map(combo),
      oneAway: oneAway.map((o) => ({
        combo: combo(o.combo),
        missing: comboCard(o.missing),
        status: o.status,
        price: o.price,
      })),
      oneAwayTotal: result.oneAway.length,
      keyCards: keys.map((k) => ({ ...k, card: comboCard(k.card) })),
      bracket: result.bracket,
      fetchedAt: result.fetchedAt.toISOString(),
      stale: result.stale,
      warning: result.warning,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
