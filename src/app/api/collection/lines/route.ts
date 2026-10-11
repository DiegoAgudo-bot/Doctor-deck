import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import { collectionLines } from "@/application/collection-cards";
import { getContainer } from "@/server/container";
import { cardWithPrintingDTO, type CollectionLineDTO } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mis líneas de una carta (`?oracleId=`), del CSV y añadidas a mano, con su edición y precio. */
export async function GET(req: NextRequest) {
  await connection();
  try {
    const user = await requireUser(req);
    const oracleId = z
      .string()
      .min(1)
      .max(64)
      .parse(req.nextUrl.searchParams.get("oracleId") ?? "");
    const c = getContainer();
    const lines = await collectionLines(oracleId, {
      cards: c.cards,
      collection: c.collectionFor(user.id),
    });
    const body: CollectionLineDTO[] = lines.map((l) => ({
      id: l.id,
      card: cardWithPrintingDTO(l.card, l.printing ?? undefined),
      quantity: l.quantity,
      foil: l.foil,
      language: l.language,
      condition: l.condition,
      source: l.source,
      printing: l.printing
        ? {
            scryfallId: l.printing.scryfallId,
            setCode: l.printing.setCode,
            setName: l.printing.setName ?? null,
            collectorNumber: l.printing.collectorNumber,
          }
        : null,
      unitPrice: l.unitPrice,
      addedAt: l.addedAt.toISOString(),
    }));
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
