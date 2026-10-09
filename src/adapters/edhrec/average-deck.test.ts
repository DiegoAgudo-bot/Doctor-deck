import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient } from "../http/http-client";
import { MemoryResponseCache } from "../http/memory-cache";
import { parseAverageDeck } from "./average-deck";
import { EdhrecClient } from "./edhrec-client";
import { EdhrecError } from "./errors";

describe("parseAverageDeck", () => {
  it("lee el mazo medio real de EDHREC: 99 cartas sin el comandante", () => {
    const r = parseAverageDeck(readFixture("edhrec/average-deck-winota.json"));
    if (r.kind !== "page") throw new Error();
    expect(r.page.commanders).toEqual(["Winota, Joiner of Forces"]);
    expect(r.page.cards.reduce((n, c) => n + c.quantity, 0)).toBe(99);
    expect(r.page.cards.map((c) => c.name)).not.toContain("Winota, Joiner of Forces");
    expect(r.page.cards.find((c) => c.name === "Arcane Signet")).toEqual({
      name: "Arcane Signet",
      quantity: 1,
    });
  });

  it("quita al comandante si viene entre las cartas y respeta las cantidades", () => {
    const r = parseAverageDeck(readFixture("edhrec/average-deck-teferi.json"));
    if (r.kind !== "page") throw new Error();
    expect(r.page.cards).toContainEqual({ name: "Island", quantity: 30 });
    expect(r.page.cards.map((c) => c.name)).not.toContain("Teferi, Temporal Archmage");
  });

  it("redirecciones y formatos inesperados", () => {
    expect(parseAverageDeck('{"redirect":"/average-decks/otro"}')).toEqual({
      kind: "redirect",
      path: "/average-decks/otro",
    });
    expect(() => parseAverageDeck('{"deck":{"cards":{}}}')).toThrow(EdhrecError);
    expect(() => parseAverageDeck('{"cosa":1}')).toThrow(/estructura esperada/);
    expect(() => parseAverageDeck("<html>")).toThrow(/JSON válido/);
  });
});

describe("EdhrecClient.getAverageDeck", () => {
  it("pide /average-decks/{slug}[/{tema}] y lo cachea", async () => {
    const calls: string[] = [];
    const client = new EdhrecClient({
      http: new HttpClient({
        userAgent: "test",
        minIntervalMs: 0,
        clock: { now: () => 0, sleep: async () => undefined },
        fetchFn: async (url) => {
          calls.push(url);
          return new Response(readFixture("edhrec/average-deck-teferi.json"));
        },
      }),
      cache: new MemoryResponseCache(),
      ttlMs: 3_600_000,
    });
    const deck = await client.getAverageDeck({ commanders: ["Teferi, Temporal Archmage"] });
    expect(deck).toMatchObject({
      commanderSlug: "teferi-temporal-archmage",
      theme: null,
      stale: false,
    });
    await client.getAverageDeck({ commanders: ["Teferi, Temporal Archmage"] });
    await client.getAverageDeck({ commanders: ["Teferi, Temporal Archmage"], theme: "control" });
    expect(calls).toEqual([
      "https://json.edhrec.com/pages/average-decks/teferi-temporal-archmage.json",
      "https://json.edhrec.com/pages/average-decks/teferi-temporal-archmage/control.json",
    ]);
  });
});
