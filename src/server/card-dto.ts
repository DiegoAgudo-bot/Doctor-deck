import type { CardDetail } from "@/application/card-catalog";
import type { Card } from "@/domain/cards/types";
import { ROLE_LABELS, type Role } from "@/domain/roles/types";
import {
  cardDTO,
  printingDTO,
  type CardDTO,
  type PrintingDTO,
  type SavedDeckSummaryDTO,
} from "./dto";

/** Una carta del buscador, con su precio más barato. */
export interface CatalogCardDTO extends CardDTO {
  price: number | null;
}

export interface CatalogPageDTO {
  items: CatalogCardDTO[];
  total: number;
}

export const catalogCardDTO = (c: Card, prices: ReadonlyMap<string, number>): CatalogCardDTO => ({
  ...cardDTO(c),
  price: prices.get(c.oracleId) ?? null,
});

/** Ficha de una carta. */
export interface CardDetailDTO {
  card: CardDTO;
  oracleText: string | null;
  keywords: string[];
  legalCommander: boolean;
  edhrecRank: number | null;
  roles: { role: Role; label: string; primary: boolean }[];
  /** Puede ser comandante: botón "Crear mazo". */
  commander: boolean;
  printings: PrintingDTO[];
  minPrice: number | null;
  minFoilPrice: number | null;
  mine: { owned: number; free: number; usedIn: string[]; wished: number } | null;
  commanderDecks: (SavedDeckSummaryDTO & { owner: string | null })[];
}

export function cardDetailDTO(
  d: CardDetail,
  decks: (SavedDeckSummaryDTO & { owner: string | null })[],
): CardDetailDTO {
  return {
    card: cardDTO(d.card),
    oracleText: d.card.oracleText,
    keywords: d.card.keywords,
    legalCommander: d.card.legalCommander,
    edhrecRank: d.card.edhrecRank,
    roles: d.roles.roles.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      primary: role === d.roles.primary,
    })),
    commander: d.commander,
    printings: d.printings.map(printingDTO),
    minPrice: d.minPrice,
    minFoilPrice: d.minFoilPrice,
    mine: d.mine,
    commanderDecks: decks,
  };
}
