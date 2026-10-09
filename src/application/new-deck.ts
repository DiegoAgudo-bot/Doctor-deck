import {
  canBeCommander,
  combinedColorIdentity,
  isValidCommanderPair,
} from "@/domain/cards/commander";
import type { Card } from "@/domain/cards/types";
import { exportDecklist } from "@/domain/deck/export";
import { suggestedDeckName } from "@/domain/deck/naming";
import type { CardRepository } from "@/domain/ports/card-repository";
import type { AverageDeckSource, RecommendationSource } from "@/domain/ports/recommendation-source";
import type { ThemeLink } from "@/domain/recommendations/types";

export class InvalidCommanderError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const shortName = (name: string) => name.split(/,| \/\/ /)[0] ?? name;

async function loadCommanders(ids: readonly string[], cards: CardRepository): Promise<Card[]> {
  const found = await cards.findCardsByOracleIds(ids);
  const commanders = ids.flatMap((id) => found.filter((c) => c.oracleId === id));
  if (commanders.length !== ids.length || commanders.length === 0) {
    throw new InvalidCommanderError("No encuentro ese comandante en el catálogo.");
  }
  if (!commanders.every(canBeCommander)) {
    throw new InvalidCommanderError("Esa carta no puede ser comandante.");
  }
  const [a, b] = commanders;
  if (!a || !isValidCommanderPair(a, b)) {
    throw new InvalidCommanderError("Esos dos comandantes no pueden ir juntos.");
  }
  return commanders;
}

/** Temas de EDHREC del comandante, de más a menos mazos. */
const byPopularity = (themes: readonly ThemeLink[]) =>
  [...themes].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

export interface CommanderInfo {
  commanders: Card[];
  themes: ThemeLink[];
  totalDecks: number | null;
  /** Nombre propuesto para el mazo medio general ("Boros - Fichas y Combates extra"). */
  suggestedName: string;
  warning: string | null;
}

/** Lo que hace falta para elegir cómo crear el mazo: temas de EDHREC y nombre propuesto. */
export async function commanderInfo(
  commanderIds: readonly string[],
  deps: { cards: CardRepository; recommendations: RecommendationSource },
): Promise<CommanderInfo> {
  const commanders = await loadCommanders(commanderIds, deps.cards);
  const recs = await deps.recommendations.getRecommendations({
    commanders: commanders.map((c) => c.name),
  });
  const themes = byPopularity(recs.themes);
  return {
    commanders,
    themes,
    totalDecks: recs.totalDecks,
    suggestedName: suggestedDeckName(
      combinedColorIdentity(commanders),
      themes.map((t) => t.name),
      shortName(commanders[0]?.name ?? ""),
    ),
    warning: recs.warning,
  };
}

export interface NewDeckRequest {
  commanderIds: readonly string[];
  /** "average": el mazo medio de EDHREC; "empty": solo el comandante, para montarlo desde cero. */
  mode: "average" | "empty";
  /** Slug del tema de EDHREC (solo con "average"). */
  theme?: string | undefined;
}

export interface NewDeck {
  /** La lista en texto (Commander / Deck), lista para guardar o analizar. */
  input: string;
  name: string;
  theme: string | null;
  commanders: Card[];
  /** Copias en las 99. */
  cardCount: number;
  warning: string | null;
}

/**
 * Crea un mazo a partir del comandante: el mazo medio de EDHREC (general o de un tema) o vacío.
 * Nombre: "<colores> - <tema(s)>". Con un tema elegido, el nombre usa ese tema; si no, los dos
 * temas más jugados del comandante. Vacío: "<colores> - <comandante>".
 */
export async function newDeckFromCommander(
  req: NewDeckRequest,
  deps: {
    cards: CardRepository;
    recommendations: RecommendationSource;
    averageDecks: AverageDeckSource;
  },
): Promise<NewDeck> {
  const commanders = await loadCommanders(req.commanderIds, deps.cards);
  const identity = combinedColorIdentity(commanders);
  const fallback = shortName(commanders[0]?.name ?? "");
  const commanderLines = commanders.map((c) => ({ oracleId: c.oracleId, name: c.name }));

  if (req.mode === "empty") {
    return {
      input: exportDecklist({ commanders: commanderLines, cards: [] }),
      name: suggestedDeckName(identity, [], fallback),
      theme: null,
      commanders,
      cardCount: 0,
      warning: null,
    };
  }

  const names = commanders.map((c) => c.name);
  const [average, recs] = await Promise.all([
    deps.averageDecks.getAverageDeck({ commanders: names, theme: req.theme }),
    deps.recommendations.getRecommendations({ commanders: names }),
  ]);
  const chosen = req.theme ? recs.themes.find((t) => t.slug === req.theme) : undefined;
  const themes = chosen ? [chosen.name] : byPopularity(recs.themes).map((t) => t.name);
  const deckText = [
    "Commander",
    ...commanders.map((c) => `1 ${c.name}`),
    "",
    "Deck",
    ...average.cards.map((c) => `${c.quantity} ${c.name}`),
  ].join("\n");
  return {
    input: deckText,
    name: suggestedDeckName(identity, themes, fallback),
    theme: req.theme ?? null,
    commanders,
    cardCount: average.cards.reduce((n, c) => n + c.quantity, 0),
    warning: average.warning ?? recs.warning,
  };
}
