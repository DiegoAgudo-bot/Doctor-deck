import { z } from "zod";
import { identifyScan } from "@/application/scan";
import { NameIndex } from "@/domain/cards/name-match";
import { getContainer } from "@/server/container";
import { cardWithPrintingDTO, printingDTO, type ScanIdentifyResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { readJson } from "@/server/body";
import { clientKey, enforceLimit, routeLimits } from "@/server/rate-limit";
import { requireUser } from "@/server/session";

const schema = z.object({
  /** Líneas que ha leído la cámara, de arriba abajo. */
  lines: z.array(z.string().max(200)).max(60),
});

/**
 * Escáner de la app: reconoce una carta por el texto que lee la cámara (edición y número de
 * coleccionista o, si no, el nombre). Solo identifica; añadirla es `POST /api/collection/cards`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    enforceLimit(routeLimits.scan, clientKey(request, user.id));
    const { lines } = schema.parse(await readJson(request));
    const c = getContainer();
    const key = lines.map((l) => l.trim()).join("\n");
    const { value: result } = await c.scanResults.get(key, () =>
      identifyScan(lines, {
        cards: c.cards,
        names: async () =>
          (await c.scanNames.get("all", async () => new NameIndex(await c.cards.nameEntries())))
            .value,
      }),
    );
    const m = result.match;
    const price =
      m &&
      (m.printing?.priceEur ??
        (await c.cards.findMinPrices([m.card.oracleId])).get(m.card.oracleId) ??
        null);
    const body: ScanIdentifyResponse = {
      reading: {
        setCode: result.reading.setCode,
        collectorNumber: result.reading.collectorNumber,
        language: result.reading.language,
      },
      match: m
        ? {
            card: cardWithPrintingDTO(m.card, m.printing ?? undefined),
            printing: m.printing ? printingDTO(m.printing) : null,
            price: price ?? null,
            confidence: m.confidence,
            via: m.via,
          }
        : null,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
