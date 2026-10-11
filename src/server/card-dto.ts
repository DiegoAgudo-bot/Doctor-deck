import type { CardDetail } from "@/application/card-catalog";
import type { ThemeLink } from "@/domain/recommendations/types";
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

/** Una carta de las listas de EDHREC de un comandante. */
export interface StapleDTO {
  card: CardDTO;
  /** % de los mazos del comandante que la llevan (0..1). */
  inclusion: number | null;
  /** Sinergia (+0.12 = se juega un 12 % más con este comandante que en sus colores). */
  synergy: number | null;
  numDecks: number | null;
  price: number | null;
  /** Con sesión: cuántas tengo y cuántas libres (null = ninguna o sin sesión). */
  mine: { owned: number; free: number } | null;
}

export interface CommanderStaplesDTO {
  theme: string | null;
  themes: ThemeLink[];
  totalDecks: number | null;
  /** Slug de EDHREC (para enlazar a su página). */
  slug: string;
  sections: { key: string; label: string; cards: StapleDTO[] }[];
  /** Si EDHREC falló y se usa una copia antigua. */
  warning: string | null;
}
