import { frontFace, nameKey } from "./names";
import type { Card, Printing } from "./types";

/** Búsquedas síncronas sobre un subconjunto de cartas ya cargado en memoria. */
export interface CardIndex {
  card(oracleId: string): Card | undefined;
  printingById(scryfallId: string): Printing | undefined;
  printingBySetNumber(setCode: string, collectorNumber: string): Printing | undefined;
  /** Por nombre completo o por nombre de la primera cara (cartas `A // B`). */
  cardByName(name: string): Card | undefined;
}

/** Layouts que no son cartas jugables: se usan solo si no hay otra coincidencia por nombre. */
const NON_GAME_LAYOUTS = new Set([
  "token",
  "double_faced_token",
  "emblem",
  "art_series",
  "planar",
  "scheme",
  "vanguard",
]);

const setNumberKey = (setCode: string, num: string) => `${setCode.toLowerCase()}|${num}`;

export class InMemoryCardIndex implements CardIndex {
  private readonly byOracle = new Map<string, Card>();
  private readonly byScryfallId = new Map<string, Printing>();
  private readonly bySetNumber = new Map<string, Printing>();
  private readonly byName = new Map<string, Card>();
  private readonly byFrontFace = new Map<string, Card>();

  constructor(cards: Iterable<Card>, printings: Iterable<Printing> = []) {
    for (const c of cards) {
      this.byOracle.set(c.oracleId, c);
      putPreferred(this.byName, nameKey(c.name), c);
      if (c.name.includes("//")) putPreferred(this.byFrontFace, nameKey(frontFace(c.name)), c);
    }
    for (const p of printings) {
      this.byScryfallId.set(p.scryfallId.toLowerCase(), p);
      this.bySetNumber.set(setNumberKey(p.setCode, p.collectorNumber), p);
    }
  }

  card(oracleId: string) {
    return this.byOracle.get(oracleId);
  }

  printingById(scryfallId: string) {
    return this.byScryfallId.get(scryfallId.toLowerCase());
  }

  printingBySetNumber(setCode: string, collectorNumber: string) {
    return this.bySetNumber.get(setNumberKey(setCode, collectorNumber));
  }

  cardByName(name: string) {
    const key = nameKey(name);
    return (
      this.byName.get(key) ??
      this.byFrontFace.get(nameKey(frontFace(name))) ??
      this.byFrontFace.get(key)
    );
  }
}

function putPreferred(map: Map<string, Card>, key: string, card: Card) {
  const prev = map.get(key);
  if (!prev || (NON_GAME_LAYOUTS.has(prev.layout) && !NON_GAME_LAYOUTS.has(card.layout))) {
    map.set(key, card);
  }
}
