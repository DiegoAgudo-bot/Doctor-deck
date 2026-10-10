import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient, type FetchFn } from "../http/http-client";
import { MemoryResponseCache } from "../http/memory-cache";
import { ComboSourceError } from "./errors";
import { parseFindMyCombos } from "./find-my-combos";
import { SpellbookClient } from "./spellbook-client";

const FIXTURE = readFixture("spellbook/find-my-combos-jund.json");
const DECK = {
  commanders: ["Korvold, Fae-Cursed King"],
  main: [
    { name: "Pitiless Plunderer", quantity: 1 },
    { name: "Ashnod's Altar", quantity: 1 },
  ],
};

function client(fetchFn: FetchFn, now = () => new Date("2026-10-11T10:00:00Z")) {
  const cache = new MemoryResponseCache();
  const http = new HttpClient({ userAgent: "test", minIntervalMs: 0, fetchFn });
  return { cache, c: new SpellbookClient({ http, cache, ttlMs: 3_600_000, now }) };
}

describe("parseFindMyCombos (respuesta real recortada)", () => {
  it("saca cartas con oracleId, lo que produce (sin ayudas internas) y la etiqueta", () => {
    const r = parseFindMyCombos(JSON.parse(FIXTURE));
    expect(r?.included).toHaveLength(6);
    expect(r?.almostIncluded).toHaveLength(8);
    const first = r!.included[0]!;
    expect(first.cards.map((c) => c.name)).toEqual([
      "Pitiless Plunderer",
      "Ashnod's Altar",
      "Reassembling Skeleton",
    ]);
    expect(first.cards[0]?.oracleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.produces).toContain("Infinite colorless mana");
    expect(first.produces).not.toContain("Infinite creature ETB"); // "Helper"
    expect(first.bracketTag).toBe("E");
    expect(r!.included.find((c) => c.id === "3000-4871")?.bracketTag).toBe("S");
  });

  it("devuelve null si cambia la forma", () => {
    expect(parseFindMyCombos({ results: { combos: [] } })).toBeNull();
  });
});

describe("SpellbookClient", () => {
  it("manda el mazo por POST y cachea por lista de cartas", async () => {
    const calls: { url: string; body: string }[] = [];
    const { c } = client(async (url, init) => {
      calls.push({ url, body: String(init?.body) });
      return new Response(FIXTURE);
    });
    const first = await c.findCombos(DECK);
    expect(first).toMatchObject({ stale: false, warning: null });
    expect(first.included).toHaveLength(6);
    expect(calls[0]?.url).toBe("https://backend.commanderspellbook.com/find-my-combos?limit=500");
    expect(JSON.parse(calls[0]!.body)).toEqual({
      commanders: [{ card: "Korvold, Fae-Cursed King" }],
      main: [
        { card: "Ashnod's Altar", quantity: 1 },
        { card: "Pitiless Plunderer", quantity: 1 },
      ],
    });
    // Mismo mazo en otro orden: sale de la caché.
    await c.findCombos({ ...DECK, main: [...DECK.main].reverse() });
    expect(calls).toHaveLength(1);
  });

  it("si Spellbook falla usa la copia caducada con aviso; sin copia, error tipado", async () => {
    let online = true;
    let now = new Date("2026-10-11T10:00:00Z");
    const { c } = client(
      async () => (online ? new Response(FIXTURE) : new Response("", { status: 503 })),
      () => now,
    );
    await c.findCombos(DECK);
    online = false;
    now = new Date("2026-10-13T10:00:00Z");
    const stale = await c.findCombos(DECK);
    expect(stale.stale).toBe(true);
    expect(stale.warning).toContain("No se ha podido contactar con Commander Spellbook");
    await expect(c.findCombos({ commanders: ["Otro"], main: [] })).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("403/429: bloqueado, sin reintentos; formato raro: error de formato", async () => {
    let calls = 0;
    const blocked = client(async () => {
      calls += 1;
      return new Response("", { status: 429 });
    });
    await expect(blocked.c.findCombos(DECK)).rejects.toMatchObject({ code: "blocked" });
    expect(calls).toBe(1);
    const weird = client(async () => new Response(JSON.stringify({ hola: 1 })));
    await expect(weird.c.findCombos(DECK)).rejects.toBeInstanceOf(ComboSourceError);
    await expect(weird.c.findCombos(DECK)).rejects.toMatchObject({ code: "format" });
  });
});
