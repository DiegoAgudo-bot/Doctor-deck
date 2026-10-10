import type { CardIndex } from "../cards/card-index";
import {
  canBeCommander,
  combinedColorIdentity,
  fitsColorIdentity,
  isValidCommanderPair,
} from "../cards/commander";
import type { Card, Color } from "../cards/types";
import type { DecklistEntry, ParsedDecklist } from "./decklist";

export interface DeckCard {
  card: Card;
  quantity: number;
  /** Nº de línea(s) del texto original de donde sale la carta. */
  lines: number[];
  /** Etiquetas que traía la lista (Moxfield / Archidekt), sin repetir. */
  tags?: string[];
}

export type CommanderSource = "marked" | "detected" | "chosen" | "none";

export interface ResolvedDeck {
  commanders: Card[];
  commanderSource: CommanderSource;
  /** Si no se pudo determinar el comandante: cartas del mazo que podrían serlo. */
  commanderCandidates: Card[];
  /** Cartas de las 99 (sin los comandantes), agrupadas por oracleId. */
  cards: DeckCard[];
  unresolved: DecklistEntry[];
}

/** Resuelve las entradas a cartas, agrupa por oracleId y determina el comandante. */
export function resolveDecklist(parsed: ParsedDecklist, index: CardIndex): ResolvedDeck {
  const byOracle = new Map<string, DeckCard & { marked: boolean }>();
  const unresolved: DecklistEntry[] = [];

  for (const entry of parsed.entries) {
    const card = lookup(entry, index);
    if (!card) {
      unresolved.push(entry);
      continue;
    }
    const prev = byOracle.get(card.oracleId);
    if (prev) {
      prev.quantity += entry.quantity;
      prev.lines.push(entry.line);
      prev.marked ||= entry.commander;
      for (const t of entry.tags ?? []) if (!prev.tags?.includes(t)) (prev.tags ??= []).push(t);
    } else {
      byOracle.set(card.oracleId, {
        card,
        quantity: entry.quantity,
        lines: [entry.line],
        marked: entry.commander,
        ...(entry.tags ? { tags: [...new Set(entry.tags)] } : {}),
      });
    }
  }

  const all = [...byOracle.values()];
  const marked = all.filter((c) => c.marked).map((c) => c.card);
  const strip = (cmd: Card[]) =>
    all
      .filter((c) => !cmd.includes(c.card))
      .map(({ card, quantity, lines, tags }) => ({
        card,
        quantity,
        lines,
        ...(tags ? { tags } : {}),
      }));

  if (marked.length > 0) {
    return {
      commanders: marked,
      commanderSource: "marked",
      commanderCandidates: [],
      cards: strip(marked),
      unresolved,
    };
  }

  const candidates = all
    .filter((c) => c.quantity === 1 && canBeCommander(c.card))
    .map((c) => c.card);
  const [first, second] = candidates;
  if (candidates.length === 1 && first && isValidCommanderPair(first)) {
    return {
      commanders: [first],
      commanderSource: "detected",
      commanderCandidates: [],
      cards: strip([first]),
      unresolved,
    };
  }
  if (candidates.length === 2 && first && second && isValidCommanderPair(first, second)) {
    return {
      commanders: [first, second],
      commanderSource: "detected",
      commanderCandidates: [],
      cards: strip([first, second]),
      unresolved,
    };
  }
  return {
    commanders: [],
    commanderSource: "none",
    commanderCandidates: fittingCandidates(candidates, all),
    cards: strip([]),
    unresolved,
  };
}

/**
 * De las cartas que pueden ser comandante, las que encajan con los colores del mazo: las que solas
 * (o en una pareja válida: partner, background…) tienen una identidad de color que abarca más
 * cartas del mazo. En un mazo blanco y rojo salen las legendarias blancas y rojas, no una solo
 * blanca (las cartas rojas no cabrían). Si se ha colado alguna carta de otro color, en vez de no
 * ofrecer ninguna, se quedan las que mejor encajan.
 */
export function fittingCandidates(
  candidates: readonly Card[],
  deck: readonly { card: Card }[],
): Card[] {
  const options: Card[][] = [];
  candidates.forEach((a, i) => {
    if (isValidCommanderPair(a)) options.push([a]);
    for (const b of candidates.slice(i + 1)) {
      if (isValidCommanderPair(a, b)) options.push([a, b]);
    }
  });
  if (options.length === 0) return [...candidates];
  // Cuántas cartas del mazo (aparte de los propios comandantes) caben en la identidad de la opción.
  const coverage = (option: Card[]) => {
    const identity = combinedColorIdentity(option);
    return deck.filter((c) => !option.includes(c.card) && fitsColorIdentity(c.card, identity))
      .length;
  };
  const scored = options.map((option) => ({ option, score: coverage(option) }));
  const best = Math.max(...scored.map((s) => s.score));
  const keep = new Set(scored.filter((s) => s.score === best).flatMap((s) => s.option));
  return candidates.filter((c) => keep.has(c));
}

/** Aplica la elección de comandante(s) hecha por el usuario. */
export function chooseCommanders(deck: ResolvedDeck, oracleIds: readonly string[]): ResolvedDeck {
  const pool: DeckCard[] = [
    ...deck.commanders.map((card) => ({ card, quantity: 1, lines: [] })),
    ...deck.cards,
  ];
  const chosen = oracleIds.map((id) => pool.find((c) => c.card.oracleId === id)?.card);
  if (chosen.some((c) => !c) || chosen.length === 0 || chosen.length > 2) {
    throw new Error("Los comandantes elegidos deben ser 1 o 2 cartas del mazo");
  }
  const [a, b] = chosen as Card[];
  if (!a || !isValidCommanderPair(a, b)) {
    throw new Error("Esa combinación de comandantes no es válida");
  }
  const chosenIds = new Set(oracleIds);
  return {
    ...deck,
    commanders: chosen as Card[],
    commanderSource: "chosen",
    commanderCandidates: [],
    cards: pool.filter((c) => !chosenIds.has(c.card.oracleId)),
  };
}

function lookup(entry: DecklistEntry, index: CardIndex): Card | undefined {
  if (entry.scryfallId) {
    const p = index.printingById(entry.scryfallId);
    const card = p && index.card(p.oracleId);
    if (card) return card;
  }
  if (entry.setCode && entry.collectorNumber) {
    const p = index.printingBySetNumber(entry.setCode, entry.collectorNumber);
    const card = p && index.card(p.oracleId);
    if (card) return card;
  }
  return index.cardByName(entry.name);
}

export type DeckIssue =
  | { kind: "size"; count: number }
  | { kind: "noCommander" }
  | { kind: "duplicate"; card: Card; quantity: number }
  | { kind: "colorIdentity"; card: Card; identity: Color[] }
  | { kind: "notLegal"; card: Card };

/** Cartas que dicen "A deck can have any number of cards named ~". */
const anyNumberAllowed = (c: Card) =>
  /deck can have any number of cards named/i.test(c.oracleText ?? "");

/** Comprobaciones básicas de Commander: 100 cartas, singleton, identidad de color y legalidad. */
export function validateDeck(deck: ResolvedDeck): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const count = deck.commanders.length + deck.cards.reduce((n, c) => n + c.quantity, 0);
  if (count !== 100) issues.push({ kind: "size", count });
  if (deck.commanders.length === 0) issues.push({ kind: "noCommander" });

  const identity = combinedColorIdentity(deck.commanders);
  for (const card of deck.commanders)
    if (!card.legalCommander) issues.push({ kind: "notLegal", card });
  for (const { card, quantity } of deck.cards) {
    if (quantity > 1 && !card.isBasicLand && !anyNumberAllowed(card)) {
      issues.push({ kind: "duplicate", card, quantity });
    }
    if (deck.commanders.length > 0 && !fitsColorIdentity(card, identity)) {
      issues.push({ kind: "colorIdentity", card, identity });
    }
    if (!card.legalCommander) issues.push({ kind: "notLegal", card });
  }
  return issues;
}
