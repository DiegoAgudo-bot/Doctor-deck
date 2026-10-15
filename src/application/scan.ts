import { NameIndex } from "@/domain/cards/name-match";
import { readCardText, setCodeVariants, type ScanReading } from "@/domain/cards/scan-text";
import type { Card, Printing } from "@/domain/cards/types";
import type { CardRepository } from "@/domain/ports/card-repository";

export interface ScanMatch {
  card: Card;
  /** Impresión exacta si se ha leído la edición y el número; si no, null. */
  printing: Printing | null;
  /** Lo seguro que es (0..1): con edición + número y el nombre de acuerdo, casi 1. */
  confidence: number;
  via: "set_number" | "name";
}

export interface ScanResult {
  reading: ScanReading;
  match: ScanMatch | null;
}

/** Por debajo de esto no se devuelve nada: mejor no reconocer que reconocer mal. */
export const SCAN_MIN_CONFIDENCE = 0.72;

/**
 * Reconoce una carta por el texto que lee la cámara (líneas de arriba abajo):
 * 1. Con edición y número de coleccionista → la impresión exacta (vale también para cartas en
 *    español u otros idiomas, cuyo nombre no está en el catálogo); si hay nombre legible, tiene
 *    que cuadrar con el de esa impresión.
 * 2. Si no, por el nombre (índice difuso); con número pero sin edición, la impresión de esa
 *    carta con ese número.
 */
export async function identifyScan(
  lines: readonly string[],
  deps: { cards: CardRepository; names: () => Promise<NameIndex> },
): Promise<ScanResult> {
  const reading = readCardText(lines);
  const index = await deps.names();
  const byName = reading.nameLines
    .map((l, i) => ({ m: index.match(l, 0.6), i }))
    .filter((x): x is { m: NonNullable<typeof x.m>; i: number } => x.m !== null)
    // A igualdad, la línea de más arriba (el nombre va arriba del todo).
    .sort((a, b) => b.m.score - a.m.score || a.i - b.i)[0]?.m;

  const result = (match: ScanMatch | null): ScanResult => ({
    reading,
    match: match && match.confidence >= SCAN_MIN_CONFIDENCE ? match : null,
  });
  const cardOf = async (oracleId: string) =>
    (await deps.cards.findCardsByOracleIds([oracleId]))[0] ?? null;

  const number = reading.collectorNumber;
  if (number && reading.setCode) {
    const variants = setCodeVariants(reading.setCode);
    const found = await deps.cards.findPrintingsBySetNumbers(
      variants.map((setCode) => ({ setCode, collectorNumber: number })),
    );
    const printings = [...found].sort(
      (a, b) => variants.indexOf(a.setCode) - variants.indexOf(b.setCode),
    );
    if (printings.length > 0) {
      const cards = await deps.cards.findCardsByOracleIds(printings.map((p) => p.oracleId));
      const byId = new Map(cards.map((c) => [c.oracleId, c]));
      // ¿El nombre leído cuadra con alguna de esas impresiones?
      const local = new NameIndex(
        cards.flatMap((c) => c.name.split(" // ").map((name) => ({ oracleId: c.oracleId, name }))),
      );
      const agree = reading.nameLines
        .map((l) => local.match(l, 0.6))
        .filter((m) => m !== null)
        .sort((a, b) => b.score - a.score)[0];
      const chosen = agree ? printings.find((p) => p.oracleId === agree.oracleId) : printings[0];
      const card = chosen && byId.get(chosen.oracleId);
      if (chosen && card) {
        const foreign = reading.language !== null && reading.language !== "en";
        // Inglés con un nombre legible que no cuadra: algo se ha leído mal; manda el nombre.
        const contradicted = !agree && !foreign && byName !== undefined && byName.score >= 0.85;
        if (!contradicted) {
          const confidence = agree
            ? Math.min(0.99, 0.9 + agree.score / 10)
            : foreign || reading.nameLines.length === 0
              ? 0.9
              : 0.78;
          return result({ card, printing: chosen, confidence, via: "set_number" });
        }
      }
    }
  }

  if (!byName) return result(null);
  const card = await cardOf(byName.oracleId);
  if (!card) return result(null);
  let printing: Printing | null = null;
  if (number) {
    printing =
      (await deps.cards.findPrintingsOf(card.oracleId)).find((p) => p.collectorNumber === number) ??
      null;
  }
  return result({ card, printing, confidence: byName.score, via: "name" });
}
