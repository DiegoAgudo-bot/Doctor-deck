import { z } from "zod";
import { BrowserCollectionRepository, noSavedDecks } from "@/adapters/memory/anonymous";
import { analyzeDeck } from "@/application/analyze-deck";
import { BRACKETS } from "@/domain/deck/bracket";
import { getContainer } from "@/server/container";
import { analyzeResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { browserRoleEditsSchema, loadRoleEdits } from "@/server/role-edits";
import { currentUser } from "@/server/session";

const ids = z.array(z.string().min(1).max(64)).max(200).optional();

const analyzeRequestSchema = z.object({
  input: z.string().min(1).max(50_000),
  theme: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  commanders: z.array(z.string().min(1).max(64)).max(2).optional(),
  locked: ids,
  excluded: ids,
  deckId: z.uuid().optional(),
  useOtherDecks: z.boolean().optional(),
  /** Sin sesión: la colección guardada en el navegador, como pares [oracleId, copias]. */
  collection: z
    .array(z.tuple([z.string().min(1).max(64), z.number().int().min(1).max(10_000)]))
    .max(60_000)
    .optional(),
  buy: z
    .object({
      maxCards: z.number().int().min(1).max(30),
      maxPrice: z.number().positive().max(10_000).optional(),
      budget: z.number().positive().max(100_000).optional(),
    })
    .optional(),
  targetBracket: z.union(BRACKETS.map((b) => z.literal(b))).optional(),
  /** Sin sesión: las correcciones de roles guardadas en el navegador. */
  roleEdits: browserRoleEditsSchema,
});

export async function POST(request: Request) {
  try {
    // Sin sesión también se analiza: con la colección que manda el navegador y sin mazos guardados.
    const user = await currentUser(request);
    const { collection, roleEdits, ...req } = analyzeRequestSchema.parse(await request.json());
    const c = getContainer();
    const result = await analyzeDeck(
      { ...req, roleEdits: await loadRoleEdits(user?.id ?? null, roleEdits) },
      {
        sources: c.deckSources,
        cards: c.cards,
        collection: user ? c.collectionFor(user.id) : new BrowserCollectionRepository(collection),
        recommendations: c.edhrec,
        decks: user ? c.decksFor(user.id) : noSavedDecks,
        classifier: c.classifier,
        config: c.engineConfig,
      },
    );
    return Response.json(analyzeResponse(result, c.engineConfig));
  } catch (err) {
    return errorResponse(err);
  }
}
