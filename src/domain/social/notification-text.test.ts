import { describe, expect, it } from "vitest";
import { notificationMessage } from "./notification-text";

const base = {
  deckId: null,
  cardId: null,
  tradeId: null,
  refId: null,
  price: null,
  prevPrice: null,
};

describe("notificationMessage", () => {
  it("intercambio: quién, qué y a qué propuesta lleva", () => {
    expect(
      notificationMessage({ ...base, type: "trade_proposal", title: "", tradeId: "t1" }, "@ana"),
    ).toEqual({
      title: "Propuesta de intercambio",
      body: "@ana te ha propuesto un intercambio",
      path: "/trades/proposals/t1",
    });
  });

  it("bajada de precio con antes → ahora y enlace a lo que falta del mazo", () => {
    const m = notificationMessage(
      { ...base, type: "price_drop", title: "Sol Ring", deckId: "d1", price: 1, prevPrice: 2 },
      "",
    );
    expect(m.body).toBe("Ha bajado Sol Ring, que te falta para uno de tus mazos · 2,00 € → 1,00 €");
    expect(m.path).toBe("/decks/d1?tab=missing");
  });

  it("comentario y mazo nuevo", () => {
    expect(
      notificationMessage({ ...base, type: "deck_comment", title: "Jund", deckId: "d" }, "@b").path,
    ).toBe("/decks/d#comments");
    expect(notificationMessage({ ...base, type: "new_deck", title: "Jund" }, "@b").body).toBe(
      "@b ha publicado un mazo: Jund",
    );
  });
});
