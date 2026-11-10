import { describe, expect, it } from "vitest";
import { makeCard } from "../../tests/helpers/cards";
import { compareDeck, type CompareDeps } from "./deck-compare";

const card = (id: string, name: string) => makeCard({ oracleId: id, name });
const CARDS = [
  card("cmd", "Teferi"),
  card("sol", "Sol Ring"),
  card("crypt", "Mana Crypt"),
  card("dig", "Dig Through Time"),
  card("island", "Island"),
];

const deps = (over: Partial<CompareDeps["decks"]> = {}): CompareDeps => ({
  decks: {
    get: async () => ({ commanderNames: ["Teferi"], commanders: ["cmd"], theme: null }),
    versions: async () => ({
      current: [
        ["cmd", 1, true],
        ["sol", 1, false],
        ["crypt", 1, false],
        ["island", 30, false],
      ],
      versions: [
        {
          id: "v1",
          createdAt: new Date("2026-11-01T10:00:00Z"),
          cards: [
            ["cmd", 1, true],
            ["sol", 1, false],
            ["dig", 1, false],
            ["island", 35, false],
          ],
        },
      ],
    }),
    ...over,
  } as unknown as CompareDeps["decks"],
  cards: {
    findBasicLandIds: async () => new Set(["island"]),
    findCardsByOracleIds: async (ids: readonly string[]) =>
      CARDS.filter((c) => ids.includes(c.oracleId)),
    findCardsByNameKeys: async () => CARDS,
    findPrintingsByIds: async () => [],
    findPrintingsBySetNumbers: async () => [],
  } as unknown as CompareDeps["cards"],
  averageDecks: {
    getAverageDeck: async () => ({
      commanderSlug: "teferi",
      theme: null,
      commanders: ["Teferi"],
      cards: [
        { name: "Sol Ring", quantity: 1 },
        { name: "Dig Through Time", quantity: 1 },
        { name: "Island", quantity: 33 },
        { name: "Carta que no existe", quantity: 1 },
      ],
      fetchedAt: new Date(),
      stale: false,
      warning: null,
    }),
  },
});

describe("compareDeck", () => {
  it("con una versión anterior: lo que solo lleva cada uno, sin básicas", async () => {
    const r = await compareDeck("d", { kind: "version", versionId: "v1" }, deps());
    expect(r.onlyMine.map((x) => [x.card.name, x.copies])).toEqual([["Mana Crypt", 1]]);
    expect(r.onlyOther.map((x) => [x.card.name, x.copies])).toEqual([["Dig Through Time", 1]]);
    expect(r.shared).toBe(2);
    expect(r.versionAt).toEqual(new Date("2026-11-01T10:00:00Z"));
  });

  it("con el mazo medio: resuelve los nombres y pone al comandante en los dos lados", async () => {
    const r = await compareDeck("d", { kind: "average" }, deps());
    expect(r.onlyMine.map((x) => x.card.name)).toEqual(["Mana Crypt"]);
    expect(r.onlyOther.map((x) => x.card.name)).toEqual(["Dig Through Time"]);
    expect(r.shared).toBe(2);
    expect(r.versionAt).toBeNull();
  });

  it("si el mazo o la versión no existen, 404", async () => {
    await expect(compareDeck("d", { kind: "version", versionId: "otra" }, deps())).rejects.toThrow(
      /versión/,
    );
    await expect(
      compareDeck("d", { kind: "average" }, deps({ get: async () => null })),
    ).rejects.toThrow(/mazo/);
  });
});
