import { describe, expect, it } from "vitest";
import { parseDecklist } from "./decklist";

const names = (text: string) => parseDecklist(text).entries.map((e) => [e.quantity, e.name]);

describe("parseDecklist: formatos de línea", () => {
  it("cantidad opcional, con o sin x", () => {
    expect(names("1 Sol Ring\n1x Arcane Signet\n2X Island\nCommand Tower\n10 Forest")).toEqual([
      [1, "Sol Ring"],
      [1, "Arcane Signet"],
      [2, "Island"],
      [1, "Command Tower"],
      [10, "Forest"],
    ]);
  });

  it("extrae set y número de coleccionista", () => {
    const [e] = parseDecklist("1x Sol Ring (C21) 263").entries;
    expect(e).toMatchObject({ name: "Sol Ring", setCode: "c21", collectorNumber: "263" });
  });

  it("set sin número y números con letras o símbolos", () => {
    const { entries } = parseDecklist(
      "1 Sol Ring (C21)\n1 Fblthp, the Lost (WAR) 50a\n1 Plains (SLD) 1★",
    );
    expect(entries.map((e) => [e.name, e.setCode, e.collectorNumber])).toEqual([
      ["Sol Ring", "c21", null],
      ["Fblthp, the Lost", "war", "50a"],
      ["Plains", "sld", "1★"],
    ]);
  });

  it("mantiene nombres con comas, apóstrofos y dos caras", () => {
    expect(
      names(
        "1 Atraxa, Praetors' Voice\n1 Delver of Secrets // Insectile Aberration\n1 Fire // Ice",
      ),
    ).toEqual([
      [1, "Atraxa, Praetors' Voice"],
      [1, "Delver of Secrets // Insectile Aberration"],
      [1, "Fire // Ice"],
    ]);
  });

  it("no confunde un nombre con paréntesis no-set con un set", () => {
    // "(R)" de 1 letra no encaja como código de set
    expect(names("1 Foo (R)")).toEqual([[1, "Foo (R)"]]);
  });

  it("detecta foil *F* y *E*", () => {
    const { entries } = parseDecklist("1 Sol Ring (C21) 263 *F*\n1 Arcane Signet *E*\n1 Island");
    expect(entries.map((e) => e.foil)).toEqual([true, true, false]);
    expect(entries[0]?.name).toBe("Sol Ring");
  });

  it("ignora líneas vacías, espacios y CRLF", () => {
    expect(names("  1 Sol Ring  \r\n\r\n\t1 Island\r\n")).toEqual([
      [1, "Sol Ring"],
      [1, "Island"],
    ]);
  });
});

describe("parseDecklist: comandante", () => {
  it("sección Commander (varias grafías)", () => {
    for (const header of [
      "Commander",
      "Commander:",
      "// Commander",
      "COMMANDER (1)",
      "Commanders",
    ]) {
      const { entries } = parseDecklist(`${header}\n1 Atraxa, Praetors' Voice\nDeck\n1 Sol Ring`);
      expect(entries.map((e) => e.commander)).toEqual([true, false]);
    }
  });

  it("sección Commander seguida de cartas sin cabecera 'Deck' tras línea vacía", () => {
    // Sin cabecera de vuelta al mazo, todo lo de la sección es comandante: es lo que dice el texto.
    const { entries } = parseDecklist("Commander\n1 Thrasios, Triton Hero\n1 Tymna the Weaver");
    expect(entries.every((e) => e.commander)).toBe(true);
  });

  it("marcador *CMDR* de Moxfield", () => {
    const { entries } = parseDecklist("1 Sol Ring\n1 Atraxa, Praetors' Voice *CMDR*");
    expect(entries.map((e) => [e.name, e.commander])).toEqual([
      ["Sol Ring", false],
      ["Atraxa, Praetors' Voice", true],
    ]);
  });

  it("categorías de Archidekt", () => {
    const { entries, skipped } = parseDecklist(
      [
        "1x Atraxa, Praetors' Voice (2x2) 190 [Commander{top}]",
        "1x Sol Ring (c21) 263 [Ramp,Artifact] ^Have,#37d67a^",
        "1x Doubling Season (rvr) 125 [Maybeboard{noDeck}{noPrice}]",
      ].join("\n"),
    );
    expect(entries.map((e) => [e.name, e.setCode, e.collectorNumber, e.commander])).toEqual([
      ["Atraxa, Praetors' Voice", "2x2", "190", true],
      ["Sol Ring", "c21", "263", false],
    ]);
    expect(skipped).toHaveLength(1);
  });

  it("sin marca, ninguna entrada es comandante", () => {
    expect(
      parseDecklist("1 Atraxa, Praetors' Voice\n1 Sol Ring").entries.some((e) => e.commander),
    ).toBe(false);
  });
});

describe("parseDecklist: secciones excluidas y basura", () => {
  it("excluye banquillo, maybeboard y SB:", () => {
    const { entries, skipped } = parseDecklist(
      "Deck\n1 Sol Ring\nSideboard\n1 Lightning Bolt\nMaybeboard\n1 Counterspell\nDeck\n1 Island\nSB: 1 Negate",
    );
    expect(entries.map((e) => e.name)).toEqual(["Sol Ring", "Island"]);
    expect(skipped.map((s) => s.reason)).toEqual(
      Array(3).fill("Fuera del mazo (banquillo/maybeboard)"),
    );
  });

  it("ignora la sección About de Arena y comentarios", () => {
    const { entries, skipped } = parseDecklist(
      "About\nName Mi mazo\n\nCommander\n1 Atraxa, Praetors' Voice\n\nDeck\n# un comentario\n// otro\n1 Sol Ring",
    );
    expect(entries.map((e) => e.name)).toEqual(["Atraxa, Praetors' Voice", "Sol Ring"]);
    expect(skipped).toEqual([]);
  });

  it("informa de líneas irreconocibles con su número", () => {
    const { skipped } = parseDecklist("1 Sol Ring\n42\n0 Island");
    expect(skipped.map((s) => s.line)).toEqual([2, 3]);
  });

  it("quita etiquetas de Moxfield", () => {
    expect(names("1 Sol Ring #!Ramp #mana")).toEqual([[1, "Sol Ring"]]);
  });
});
