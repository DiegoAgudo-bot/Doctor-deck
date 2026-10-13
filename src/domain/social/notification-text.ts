import type { NewNotification, NotificationType } from "../ports/social";
import { formatEuros } from "../suggestions/format";

export const TRADE_TEXT: Partial<Record<NotificationType, string>> = {
  trade_proposal: "te ha propuesto un intercambio",
  trade_counter: "te ha hecho una contrapropuesta",
  trade_accepted: "ha aceptado vuestro intercambio: las cartas ya están en vuestras colecciones",
  trade_rejected: "ha rechazado tu propuesta de intercambio",
  trade_cancelled: "ha retirado la propuesta de intercambio",
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
  /** Frase completa en español, sin formato (push y app). */
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
): NotificationMessage {
  const title = TITLES[n.type];
  if (n.type.startsWith("trade_") && n.type !== "trade_match") {
    return {
      title,
      body: `${who} ${TRADE_TEXT[n.type] ?? "ha cambiado una propuesta de intercambio"}`,
      path: n.tradeId ? `/trades/proposals/${n.tradeId}` : "/trades?tab=proposals",
    };
  }
  switch (n.type) {
    case "group_join":
      return {
        title,
        body: `${who} ha entrado en tu grupo ${n.title}`,
        path: n.refId ? `/groups/${n.refId}` : "/groups",
      };
    case "game_recorded":
      return {
        title,
        body: `${who} ha registrado una partida en la que jugaste: ${n.title}`,
        path: n.refId ? `/games/${n.refId}` : "/groups",
      };
    case "deck_comment":
      return {
        title,
        body: `${who} ha comentado en tu mazo ${n.title}`,
        path: n.deckId ? `/decks/${n.deckId}#comments` : "/decks",
      };
    case "loan_new":
      return { title, body: `${who} te ha prestado ${n.title}`, path: "/loans" };
    case "new_deck":
      return {
        title,
        body: `${who} ha publicado un mazo: ${n.title}`,
        path: n.deckId ? `/decks/${n.deckId}` : "/community",
      };
    case "trade_match":
      return {
        title,
        body: `${who} tiene libre ${n.title}, que está en tu lista de deseos`,
        path: "/trades",
      };
    case "price_drop": {
      const price =
        n.price != null
          ? ` · ${n.prevPrice != null ? `${formatEuros(n.prevPrice)} → ` : ""}${formatEuros(n.price)}`
          : "";
      return {
        title,
        body: `Ha bajado ${n.title}, que te falta${n.deckId ? " para uno de tus mazos" : ""}${price}`,
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
        body: `${who} ha añadido ${n.title} a su colección${n.price != null ? ` · ${formatEuros(n.price)}` : ""}`,
        path: n.cardId ? `/cards/${n.cardId}` : "/notifications",
      };
  }
}
