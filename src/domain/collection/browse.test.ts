import { describe, expect, it } from "vitest";
import type { Role } from "../roles/types";
import { browseCollection, colorMatch, type BrowsableCard } from "./browse";

const card = (
  name: string,
  over: Partial<Omit<BrowsableCard, "card">> & {
    typeLine?: string;
    cmc?: number;
    colors?: string[];
  } = {},
): BrowsableCard => ({
  card: {
    name,
    typeLine: over.typeLine ?? "Creature — Elf",
    cmc: over.cmc ?? 2,
    colorIdentity: (over.colors ?? ["G"]) as never,
  },
  roles: over.roles ?? (["synergy"] as Role[]),
  quantity: over.quantity ?? 1,
  foilQuantity: over.foilQuantity ?? 0,
  fromCsv: over.fromCsv ?? 1,
  manualCount: over.manualCount ?? 0,
  inUse: over.inUse ?? 0,
  price: over.price ?? null,
  // Por defecto, precio × copias (como si todas fueran de la impresión más barata).
  value:
    over.value !== undefined
      ? over.value
      : over.price != null
        ? over.price * (over.quantity ?? 1)
        : null,
  lastAdded: over.lastAdded ?? "2026-10-01T00:00:00.000Z",
});

const CARDS = [
  card("Llanowar Elves", { cmc: 1, roles: ["ramp"], price: 0.2, quantity: 3 }),
  card("Mayhem Devil", { cmc: 3, colors: ["B", "R"], price: 2, inUse: 1 }),
  card("Sol Ring", { typeLine: "Artifact", cmc: 1, colors: [], roles: ["ramp"], price: 1.5 }),
  card("Counterspell", {
    typeLine: "Instant",
    colors: ["U"],
    foilQuantity: 1,
    manualCount: 1,
    fromCsv: 0,
  }),
  card("Ulamog, the Ceaseless Hunger", {
    typeLine: "Legendary Creature — Eldrazi",
    cmc: 10,
    colors: [],
    lastAdded: "2026-10-09T00:00:00.000Z",
  }),
];

const names = (r: { items: BrowsableCard[] }) => r.items.map((c) => c.card.name);

describe("colorMatch", () => {
  it("con alguno, dentro de la identidad y exacta; incolora con C", () => {
    expect(colorMatch(["B", "R"], ["B"], "alguno")).toBe(true);
    expect(colorMatch(["B", "R"], ["B"], "dentro")).toBe(false);
    expect(colorMatch(["B", "R"], ["B", "R", "G"], "dentro")).toBe(true);
    expect(colorMatch(["B", "R"], ["B", "R"], "exacto")).toBe(true);
    expect(colorMatch([], ["B"], "alguno")).toBe(false);
    expect(colorMatch([], ["B"], "dentro")).toBe(true); // las incoloras caben en cualquier mazo
    expect(colorMatch([], ["C"], "alguno")).toBe(true);
  });
});

describe("browseCollection", () => {
  it("filtra por texto (nombre o tipo, sin tildes), tipo, rol, coste, origen, uso y foil", () => {
    const run = (f: Parameters<typeof browseCollection>[1]) =>
      names(browseCollection(CARDS, f, "nombre", 0, 50));
    expect(run({ q: "ELDRAZI" })).toEqual(["Ulamog, the Ceaseless Hunger"]);
    expect(run({ type: "Creature" })).toEqual([
      "Llanowar Elves",
      "Mayhem Devil",
      "Ulamog, the Ceaseless Hunger",
    ]);
    expect(run({ role: "ramp" })).toEqual(["Llanowar Elves", "Sol Ring"]);
    expect(run({ cmc: 1 })).toEqual(["Llanowar Elves", "Sol Ring"]);
    expect(run({ cmc: 7 })).toEqual(["Ulamog, the Ceaseless Hunger"]);
    expect(run({ origin: "manual" })).toEqual(["Counterspell"]);
    expect(run({ use: "en-mazos" })).toEqual(["Mayhem Devil"]);
    expect(run({ use: "libres" })).not.toContain("Mayhem Devil");
    expect(run({ foil: true })).toEqual(["Counterspell"]);
    expect(run({ colors: ["G"], colorMode: "dentro" })).toEqual([
      "Llanowar Elves",
      "Sol Ring",
      "Ulamog, the Ceaseless Hunger",
    ]);
  });

  it("ordena, pagina y da los totales de todo lo filtrado", () => {
    const first = browseCollection(CARDS, {}, "precio", 0, 2);
    expect(names(first)).toEqual(["Mayhem Devil", "Sol Ring"]);
    expect(first.total).toEqual({ cards: 5, copies: 7, value: 4.1 });
    expect(names(browseCollection(CARDS, {}, "precio", 2, 2))).toEqual([
      "Llanowar Elves",
      "Counterspell",
    ]);
    expect(names(browseCollection(CARDS, {}, "recientes", 0, 1))).toEqual([
      "Ulamog, the Ceaseless Hunger",
    ]);
    expect(names(browseCollection(CARDS, {}, "coste", 0, 1))).toEqual(["Llanowar Elves"]);
    expect(browseCollection(CARDS, { q: "zzz" }, "nombre", 0, 10).total.cards).toBe(0);
  });
});

describe("valor de las copias", () => {
  it("suma el valor exacto y ordena por él", () => {
    const cards = [
      card("Barata pero muchas", { price: 1, quantity: 10 }),
      card("Foil cara", { price: 2, quantity: 1, value: 30 }),
    ];
    const page = browseCollection(cards, {}, "valor", 0, 10);
    expect(page.items.map((c) => c.card.name)).toEqual(["Foil cara", "Barata pero muchas"]);
    expect(page.total.value).toBe(40);
    expect(browseCollection(cards, {}, "precio", 0, 10).items[0]?.card.name).toBe("Foil cara");
  });
});
