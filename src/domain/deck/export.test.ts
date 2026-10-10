import { describe, expect, it } from "vitest";
import { parseDecklist } from "./decklist";
import {
  applySwaps,
  changeCard,
  exportDeck,
  exportDecklist,
  setPrinting,
  type ExportableDeck,
} from "./export";

const deck: ExportableDeck = {
  commanders: [{ oracleId: "c", name: "Teferi, Temporal Archmage" }],
  cards: [
    { oracleId: "a", name: "Tamiyo's Logbook", quantity: 1 },
    { oracleId: "i", name: "Island", quantity: 30 },
    { oracleId: "b", name: "Body of Knowledge", quantity: 1 },
  ],
};

describe("applySwaps", () => {
  it("quita la que sale y mete la que entra", () => {
    const result = applySwaps(deck, [
      { outOracleId: "a", in: { oracleId: "d", name: "Dig Through Time" } },
    ]);
    expect(result.cards.map((c) => [c.name, c.quantity])).toEqual([
      ["Island", 30],
      ["Body of Knowledge", 1],
      ["Dig Through Time", 1],
    ]);
    expect(deck.cards[0]?.quantity).toBe(1); // no muta el original
  });

  it("ignora cambios cuya carta ya no está", () => {
    const result = applySwaps(deck, [{ outOracleId: "zzz", in: { oracleId: "d", name: "Dig" } }]);
    expect(result.cards).toHaveLength(3);
  });
});

describe("exportDecklist", () => {
  it("genera texto con secciones que el propio parser vuelve a leer", () => {
    const text = exportDecklist(deck);
    expect(text).toBe(
      "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Body of Knowledge\n30 Island\n1 Tamiyo's Logbook\n",
    );
    const parsed = parseDecklist(text);
    expect(parsed.entries.filter((e) => e.commander).map((e) => e.name)).toEqual([
      "Teferi, Temporal Archmage",
    ]);
    expect(parsed.entries.reduce((n, e) => n + e.quantity, 0)).toBe(33);
  });
});

describe("changeCard", () => {
  const deck = {
    commanders: [{ oracleId: "k", name: "Korvold" }],
    cards: [{ oracleId: "s", name: "Sol Ring", quantity: 1 }],
  };
  it("añade, suma copias y quita", () => {
    const added = changeCard(deck, { oracleId: "b", name: "Lightning Bolt" }, 1);
    expect(added.cards).toEqual([
      { oracleId: "s", name: "Sol Ring", quantity: 1 },
      { oracleId: "b", name: "Lightning Bolt", quantity: 1 },
    ]);
    expect(changeCard(added, { oracleId: "b", name: "Lightning Bolt" }, 2).cards[1]?.quantity).toBe(
      3,
    );
    expect(changeCard(deck, { oracleId: "s", name: "Sol Ring" }, -1).cards).toEqual([]);
    expect(changeCard(deck, { oracleId: "x", name: "X" }, -1)).toEqual(deck);
  });
  it("no toca a los comandantes", () => {
    expect(changeCard(deck, { oracleId: "k", name: "Korvold" }, 1)).toBe(deck);
  });
});

describe("exportDeck", () => {
  const deck: ExportableDeck = {
    commanders: [{ oracleId: "c", name: "Teferi, Temporal Archmage", layout: "normal" }],
    cards: [
      { oracleId: "s", name: "Sol Ring", layout: "normal", quantity: 1 },
      { oracleId: "f", name: "Fire // Ice", layout: "split", quantity: 1 },
      {
        oracleId: "d",
        name: "Delver of Secrets // Insectile Aberration",
        layout: "transform",
        quantity: 1,
      },
      { oracleId: "b", name: "Bonecrusher Giant // Stomp", layout: "adventure", quantity: 1 },
      { oracleId: "i", name: "Island", layout: "normal", quantity: 30 },
    ],
  };

  it("texto: el formato de siempre", () => {
    expect(exportDeck(deck, "text")).toBe(exportDecklist(deck));
  });

  it("Arena: split con ///, dos caras y aventuras solo con la cara frontal", () => {
    expect(exportDeck(deck, "arena")).toBe(
      [
        "Commander",
        "1 Teferi, Temporal Archmage",
        "",
        "Deck",
        "1 Bonecrusher Giant",
        "1 Delver of Secrets",
        "1 Fire /// Ice",
        "30 Island",
        "1 Sol Ring",
        "",
      ].join("\n"),
    );
  });

  it("MTGO: las 99 y el comandante en el banquillo; split con /", () => {
    expect(exportDeck(deck, "mtgo")).toBe(
      [
        "1 Bonecrusher Giant",
        "1 Delver of Secrets",
        "1 Fire/Ice",
        "30 Island",
        "1 Sol Ring",
        "",
        "1 Teferi, Temporal Archmage",
        "",
      ].join("\n"),
    );
  });

  it("los cambios conservan el layout para exportar", () => {
    const changed = changeCard(
      applySwaps(deck, [
        { outOracleId: "s", in: { oracleId: "w", name: "Wear // Tear", layout: "split" } },
      ]),
      { oracleId: "x", name: "Expansion // Explosion", layout: "split" },
      1,
    );
    const arena = exportDeck(changed, "arena");
    expect(arena).toContain("1 Wear /// Tear");
    expect(arena).toContain("1 Expansion /// Explosion");
  });
});

describe("exportDeck: moxfield con etiquetas", () => {
  it("añade las etiquetas, sin espacios, y se vuelven a leer al importar", () => {
    const text = exportDeck(
      {
        commanders: [{ oracleId: "c", name: "Teferi, Temporal Archmage" }],
        cards: [
          { oracleId: "s", name: "Sol Ring", quantity: 1, tags: ["Ramp", "win con"] },
          { oracleId: "i", name: "Island", quantity: 30 },
        ],
      },
      "moxfield",
    );
    expect(text).toBe(
      "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n30 Island\n1 Sol Ring #Ramp #wincon\n",
    );
    const sol = parseDecklist(text).entries.find((e) => e.name === "Sol Ring");
    expect(sol?.tags).toEqual(["Ramp", "wincon"]);
  });
});

describe("impresiones al exportar", () => {
  it("escribe (SET) número, se puede quitar y se vuelve a leer al importar", () => {
    const deck: ExportableDeck = {
      commanders: [{ oracleId: "c", name: "Teferi, Temporal Archmage" }],
      cards: [{ oracleId: "s", name: "Sol Ring", quantity: 1, tags: ["Ramp"] }],
    };
    const chosen = setPrinting(deck, "s", { setCode: "lea", collectorNumber: "270" });
    const text = exportDecklist(chosen);
    expect(text).toContain("1 Sol Ring (LEA) 270");
    expect(exportDeck(chosen, "moxfield")).toContain("1 Sol Ring (LEA) 270 #Ramp");
    expect(exportDeck(chosen, "arena")).toContain("1 Sol Ring\n");
    const entry = parseDecklist(text).entries.find((e) => e.name === "Sol Ring");
    expect(entry).toMatchObject({ setCode: "lea", collectorNumber: "270" });
    // Cambiar algo del mazo no la pierde; quitarla vuelve al nombre a secas.
    expect(exportDecklist(changeCard(chosen, { oracleId: "x", name: "Island" }, 1))).toContain(
      "(LEA) 270",
    );
    expect(exportDecklist(setPrinting(chosen, "s", null))).toContain("1 Sol Ring\n");
  });
});
