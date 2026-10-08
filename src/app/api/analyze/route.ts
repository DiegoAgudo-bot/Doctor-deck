import { z } from "zod";
import { analyzeDeck } from "@/application/analyze-deck";
import { getContainer } from "@/server/container";
import { analyzeResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";

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
});

export async function POST(request: Request) {
  try {
    const req = analyzeRequestSchema.parse(await request.json());
    const c = getContainer();
    const result = await analyzeDeck(req, {
      sources: c.deckSources,
      cards: c.cards,
      collection: c.collection,
      recommendations: c.edhrec,
      classifier: c.classifier,
      config: c.engineConfig,
    });
    return Response.json(analyzeResponse(result, c.classifier, c.engineConfig));
  } catch (err) {
    return errorResponse(err);
  }
}
