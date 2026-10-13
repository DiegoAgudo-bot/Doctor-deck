import { parseDecklist } from "@/domain/deck/decklist";
import { parseManaboxCsv } from "@/domain/collection/manabox";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import { addToCollection, type AddCardInput, type AddCardsResult } from "./collection-cards";

/**
 * Lo que llega al compartir desde ManaBox (u otra app) a la app móvil: el CSV de la colección o una
 * lista de texto (`1 Bilbo, Thief in the Night (HOB) 33 *F*`). Se resuelve contra el catálogo
 * para enseñar qué se va a añadir antes de hacerlo.
 */
export type SharedKind = "csv" | "list";

export interface SharedImport extends AddCardsResult {
  kind: SharedKind;
  /** Nombre que trae la lista (si lo trae), para proponerlo al crear un mazo. */
  name: string | null;
  /** Copias encontradas. */
  totalCopies: number;
  /** Tiene comandante marcado o 60–101 cartas: la app propone "Crear mazo" primero. */
  looksLikeDeck: boolean;
  /** Líneas que no se entendieron (texto) o filas inválidas (CSV). */
  skipped: number;
}

/** CSV con cabecera de ManaBox (o de cualquier export con "Name" y "Quantity"). */
export const looksLikeCsv = (text: string) => {
  const first = text.trimStart().split(/\r?\n/, 1)[0] ?? "";
  return /(^|,)"?Name"?(,|$)/.test(first) && /(^|,)"?Quantity"?(,|$)/.test(first);
};

/** Las entradas a añadir a partir del texto compartido, sin tocar la colección. */
async function sharedInputs(
  text: string,
  cards: CardRepository,
): Promise<{
  kind: SharedKind;
  items: AddCardInput[];
  name: string | null;
  commander: boolean;
  skipped: number;
}> {
  if (looksLikeCsv(text)) {
    const parsed = parseManaboxCsv(text);
    return {
      kind: "csv",
      name: null,
      commander: false,
      skipped: parsed.errors.length,
      items: parsed.rows.map((r) => ({
        ...(r.scryfallId ? { scryfallId: r.scryfallId } : { name: r.name }),
        quantity: r.quantity,
        foil: r.foil,
        language: r.language ?? undefined,
        condition: r.condition ?? undefined,
      })),
    };
  }
  const parsed = parseDecklist(text);
  // `(SET) número` → la impresión concreta; si no está en el catálogo, por nombre.
  const pairs = parsed.entries.flatMap((e) =>
    e.setCode && e.collectorNumber
      ? [{ setCode: e.setCode, collectorNumber: e.collectorNumber }]
      : [],
  );
  const printings = pairs.length > 0 ? await cards.findPrintingsBySetNumbers(pairs) : [];
  const key = (set: string, num: string) => `${set.toLowerCase()}|${num.toLowerCase()}`;
  const bySetNumber = new Map(
    printings.map((p) => [key(p.setCode, p.collectorNumber), p.scryfallId]),
  );
  return {
    kind: "list",
    name: parsed.name ?? null,
    commander: parsed.entries.some((e) => e.commander),
    skipped: parsed.skipped.length,
    items: parsed.entries.map((e) => {
      const scryfallId =
        e.scryfallId ??
        (e.setCode && e.collectorNumber
          ? bySetNumber.get(key(e.setCode, e.collectorNumber))
          : undefined);
      return {
        ...(scryfallId ? { scryfallId } : { name: e.name }),
        quantity: e.quantity,
        foil: e.foil,
      };
    }),
  };
}

/**
 * Resuelve lo compartido y, si `collection` guarda (con cuenta), lo añade como cartas sueltas
 * (`matchMethod = "manual"`: reimportar el CSV no las borra). Para solo previsualizar, pasar un
 * repositorio que no guarda (`BrowserCollectionRepository`).
 */
export async function importShared(
  text: string,
  deps: { cards: CardRepository; collection: CollectionRepository },
): Promise<SharedImport> {
  const { kind, items, name, commander, skipped } = await sharedInputs(text, deps.cards);
  const result = await addToCollection(items, deps);
  const totalCopies = result.added.reduce((s, a) => s + a.quantity, 0);
  return {
    ...result,
    kind,
    name,
    totalCopies,
    looksLikeDeck: kind === "list" && (commander || (totalCopies >= 60 && totalCopies <= 101)),
    skipped,
  };
}
