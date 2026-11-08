import type { Locale } from "../i18n/locale";
import type { NewNotification, NotificationType } from "../ports/social";
import { formatEuros } from "../suggestions/format";

export const TRADE_TEXT: Partial<Record<NotificationType, string>> = {
  trade_proposal: "te ha propuesto un intercambio",
  trade_counter: "te ha hecho una contrapropuesta",
  trade_accepted: "ha aceptado vuestro intercambio: las cartas ya están en vuestras colecciones",
  trade_rejected: "ha rechazado tu propuesta de intercambio",
  trade_cancelled: "ha retirado la propuesta de intercambio",
};

export const TRADE_TEXT_EN: Partial<Record<NotificationType, string>> = {
  trade_proposal: "proposed a trade to you",
  trade_counter: "sent you a counter-offer",
  trade_accepted: "accepted your trade: the cards are already in your collections",
  trade_rejected: "rejected your trade proposal",
  trade_cancelled: "withdrew the trade proposal",
};

const TITLES_EN: Record<NotificationType, string> = {
  new_deck: "New deck",
  big_card: "New card in a collection",
  price_drop: "Price drop",
  trade_match: "Trade match",
  trade_proposal: "Trade proposal",
  trade_counter: "Counter-offer",
  trade_accepted: "Trade accepted",
  trade_rejected: "Trade rejected",
  trade_cancelled: "Trade withdrawn",
  group_join: "Playgroup",
  game_recorded: "Game recorded",
  deck_comment: "New comment",
  loan_new: "Loan",
};

/** Título corto (para la notificación push) por tipo. */
const TITLES: Record<NotificationType, string> = {
  new_deck: "Mazo nuevo",
  big_card: "Carta nueva en una colección",
  price_drop: "Ha bajado de precio",
  trade_match: "Cruce de intercambio",
  trade_proposal: "Propuesta de intercambio",
  trade_counter: "Contrapropuesta",
  trade_accepted: "Intercambio aceptado",
  trade_rejected: "Intercambio rechazado",
  trade_cancelled: "Intercambio retirado",
  group_join: "Grupo de juego",
  game_recorded: "Partida registrada",
  deck_comment: "Comentario nuevo",
  loan_new: "Préstamo",
};

export interface NotificationMessage {
  title: string;
  /** Frase completa, sin formato (push y app). */
  body: string;
  /** Ruta de la web a la que lleva (la app la traduce a su pantalla). */
  path: string;
}

/**
 * El texto de un aviso, para la notificación push y la app (la web lo pinta con enlaces).
 * `who` es "@usuario" o el nombre de quien lo ha provocado.
 */
export function notificationMessage(
  n: Pick<
    NewNotification,
    "type" | "title" | "deckId" | "cardId" | "tradeId" | "refId" | "price" | "prevPrice"
  >,
  who: string,
  locale: Locale = "es",
): NotificationMessage {
  const en = locale === "en";
  const t = (es: string, english: string) => (en ? english : es);
  const eur = (x: number) => formatEuros(x, locale);
  const title = (en ? TITLES_EN : TITLES)[n.type];
  if (n.type.startsWith("trade_") && n.type !== "trade_match") {
    const text = en
      ? (TRADE_TEXT_EN[n.type] ?? "changed a trade proposal")
      : (TRADE_TEXT[n.type] ?? "ha cambiado una propuesta de intercambio");
    return {
      title,
      body: `${who} ${text}`,
      path: n.tradeId ? `/trades/proposals/${n.tradeId}` : "/trades?tab=proposals",
    };
  }
  switch (n.type) {
    case "group_join":
      return {
        title,
        body: t(`${who} ha entrado en tu grupo ${n.title}`, `${who} joined your group ${n.title}`),
        path: n.refId ? `/groups/${n.refId}` : "/groups",
      };
    case "game_recorded":
      return {
        title,
        body: t(
          `${who} ha registrado una partida en la que jugaste: ${n.title}`,
          `${who} recorded a game you played: ${n.title}`,
        ),
        path: n.refId ? `/games/${n.refId}` : "/groups",
      };
    case "deck_comment":
      return {
        title,
        body: t(
          `${who} ha comentado en tu mazo ${n.title}`,
          `${who} commented on your deck ${n.title}`,
        ),
        path: n.deckId ? `/decks/${n.deckId}#comments` : "/decks",
      };
    case "loan_new":
      return {
        title,
        body: t(`${who} te ha prestado ${n.title}`, `${who} lent you ${n.title}`),
        path: "/loans",
      };
    case "new_deck":
      return {
        title,
        body: t(`${who} ha publicado un mazo: ${n.title}`, `${who} published a deck: ${n.title}`),
        path: n.deckId ? `/decks/${n.deckId}` : "/community",
      };
    case "trade_match":
      return {
        title,
        body: t(
          `${who} tiene libre ${n.title}, que está en tu lista de deseos`,
          `${who} has a spare ${n.title}, which is on your wishlist`,
        ),
        path: "/trades",
      };
    case "price_drop": {
      const price =
        n.price != null
          ? ` · ${n.prevPrice != null ? `${eur(n.prevPrice)} → ` : ""}${eur(n.price)}`
          : "";
      return {
        title,
        body: en
          ? `${n.title} dropped in price, and you're missing it${n.deckId ? " for one of your decks" : ""}${price}`
          : `Ha bajado ${n.title}, que te falta${n.deckId ? " para uno de tus mazos" : ""}${price}`,
        path: n.deckId
          ? `/decks/${n.deckId}?tab=missing`
          : n.cardId
            ? `/cards/${n.cardId}`
            : "/notifications",
      };
    }
    default:
      return {
        title,
        body:
          t(
            `${who} ha añadido ${n.title} a su colección`,
            `${who} added ${n.title} to their collection`,
          ) + (n.price != null ? ` · ${eur(n.price)}` : ""),
        path: n.cardId ? `/cards/${n.cardId}` : "/notifications",
      };
  }
}
