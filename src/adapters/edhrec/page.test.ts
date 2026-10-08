import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { EdhrecError } from "./errors";
import { parseEdhrecPage, type ParsedPage } from "./page";

function page(file: string): ParsedPage {
  const r = parseEdhrecPage(readFixture(`edhrec/${file}`));
  if (r.kind !== "page") throw new Error("se esperaba una página");
  return r.page;
}

describe("parseEdhrecPage", () => {
  const p = page("teferi-temporal-archmage.json");
  const card = (name: string) => p.cards.find((c) => c.name === name);

  it("extrae synergy, inclusión y nº de mazos", () => {
    expect(card("Dig Through Time")).toMatchObject({
      synergy: 0.31,
      numDecks: 1520,
      potentialDecks: 4000,
    });
    expect(card("Dig Through Time")?.inclusion).toBeCloseTo(0.38);
  });

  it("une las cartas repetidas en varias listas y conserva sus categorías", () => {
    expect(p.cards.filter((c) => c.name === "Sol Ring")).toHaveLength(1);
    expect(card("Sol Ring")?.categories).toEqual(["topcards", "manaartifacts"]);
    expect(card("Dig Through Time")?.categories).toEqual(["highsynergycards", "topcards"]);
  });

  it("calcula la inclusión desde la etiqueta si faltan los contadores", () => {
    const c = card("Marang River Regent // Coil and Catch");
    expect(c?.numDecks).toBeNull();
    expect(c?.inclusion).toBeCloseTo(0.16);
  });

  it("admite cartas sin synergy y con synergy negativa", () => {
    expect(card("Reliquary Tower")?.synergy).toBeNull();
    expect(card("Ichor Synthesizer")?.synergy).toBe(-0.01);
  });

  it("lee el total de mazos y los temas", () => {
    expect(p.totalDecks).toBe(4000);
    expect(p.themes).toEqual([
      { slug: "control", name: "Control", count: 812 },
      { slug: "spellslinger", name: "Spellslinger", count: 401 },
      { slug: "superfriends", name: "Planeswalkers", count: 150 },
    ]);
  });

  it("lee páginas de tema", () => {
    const t = page("teferi-temporal-archmage-control.json");
    expect(t.totalDecks).toBe(812);
    expect(t.cards.find((c) => c.name === "Zimone's Hypothesis")?.synergy).toBe(0.4);
  });

  it("reconoce redirecciones", () => {
    expect(parseEdhrecPage(readFixture("edhrec/redirect.json"))).toEqual({
      kind: "redirect",
      path: "/commanders/teferi-temporal-archmage",
    });
  });

  it("rechaza redirecciones fuera de /commanders", () => {
    expect(() => parseEdhrecPage('{"redirect":"https://evil.example/x"}')).toThrow(EdhrecError);
  });

  it("lanza un error de formato si la estructura ha cambiado", () => {
    const err = (() => {
      try {
        parseEdhrecPage(readFixture("edhrec/changed-format.json"), "https://x");
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(EdhrecError);
    expect((err as EdhrecError).code).toBe("format");
    expect((err as EdhrecError).message).toMatch(/estructura esperada/);
  });

  it("lanza un error de formato si no es JSON", () => {
    expect(() => parseEdhrecPage("<html>Cloudflare</html>")).toThrow(/JSON válido/);
  });
});
