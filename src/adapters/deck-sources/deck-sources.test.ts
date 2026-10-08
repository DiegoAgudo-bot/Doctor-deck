import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient } from "../http/http-client";
import { archidektDeckSource, parseArchidektDeck } from "./archidekt";
import { DeckSourceError } from "./errors";
import { moxfieldDeckSource, parseMoxfieldDeck } from "./moxfield";
import { textDeckSource } from "./text-deck-source";

const json = (file: string) => JSON.parse(readFixture(`deck-sources/${file}`)) as unknown;

function http(route: (url: string) => Response | Error) {
  const calls: string[] = [];
  const client = new HttpClient({
    userAgent: "DeckDoctor/test",
    minIntervalMs: 0,
    clock: { now: () => 0, sleep: async () => undefined },
    fetchFn: async (url) => {
      calls.push(url);
      const r = route(url);
      if (r instanceof Error) throw r;
      return r;
    },
  });
  return { client, calls };
}

async function expectSourceError(p: Promise<unknown>, code: DeckSourceError["code"]) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(DeckSourceError);
  expect((err as DeckSourceError).code).toBe(code);
  return err as DeckSourceError;
}

describe("canHandle", () => {
  const { client } = http(() => new Response("{}"));
  const arch = archidektDeckSource(client);
  const mox = moxfieldDeckSource(client);
  it.each([
    ["https://archidekt.com/decks/123456/teferi-control", "archidekt"],
    ["https://www.archidekt.com/decks/123456", "archidekt"],
    ["  https://moxfield.com/decks/AbC123_-x  ", "moxfield"],
    ["https://www.moxfield.com/decks/AbC123_-x/primer", "moxfield"],
    ["1 Sol Ring", "text"],
    ["https://otra-web.com/decks/1", "ninguna"],
  ])("%s → %s", (input, expected) => {
    const found = [arch, mox, textDeckSource].find((s) => s.canHandle(input));
    expect(found?.id ?? "ninguna").toBe(expected);
  });
});

describe("Archidekt", () => {
  it("convierte el JSON en entradas: comandante, Scryfall ID, set y número; ignora maybeboard", () => {
    const deck = parseArchidektDeck(json("archidekt.json"));
    expect(deck.name).toBe("Teferi control");
    expect(
      deck.entries.map((e) => [
        e.name,
        e.quantity,
        e.commander,
        e.scryfallId,
        e.setCode,
        e.collectorNumber,
      ]),
    ).toEqual([
      ["Teferi, Temporal Archmage", 1, true, "66666666-0000-4000-8000-000000000012", "c14", "12"],
      ["Sol Ring", 1, false, "33333333-0000-4000-8000-000000000270", "lea", "270"],
      ["Dig Through Time", 1, false, null, "dsc", "115"],
      ["Island", 30, false, "44444444-0000-4000-8000-000000000278", "dsk", "278"],
      ["Grizzled Angler // Grisly Anglerfish", 1, false, null, "xxx", "1"],
    ]);
    expect(deck.skipped.map((s) => s.reason)).toEqual(["Fuera del mazo (Maybeboard)"]);
  });

  it("pide el endpoint JSON público con el id del link", async () => {
    const { client, calls } = http(() => new Response(readFixture("deck-sources/archidekt.json")));
    await archidektDeckSource(client).load("https://archidekt.com/decks/123456/teferi-control");
    expect(calls).toEqual(["https://archidekt.com/api/decks/123456/"]);
  });

  it("errores tipados: 404, 403, red y formato", async () => {
    const src = (r: Response | Error) => archidektDeckSource(http(() => r).client);
    const link = "https://archidekt.com/decks/1";
    await expectSourceError(src(new Response("", { status: 404 })).load(link), "not_found");
    const blocked = await expectSourceError(
      src(new Response("", { status: 403 })).load(link),
      "blocked",
    );
    expect(blocked.message).toMatch(/pégala/);
    await expectSourceError(src(new TypeError("fetch failed")).load(link), "unavailable");
    await expectSourceError(src(new Response("<html>")).load(link), "format");
    await expectSourceError(src(new Response('{"cards":"no"}')).load(link), "format");
  });
});

describe("Moxfield", () => {
  it("lee el formato v3 (boards)", () => {
    const deck = parseMoxfieldDeck(json("moxfield-v3.json"));
    expect(deck.name).toBe("Teferi (Moxfield)");
    expect(deck.entries.map((e) => [e.name, e.quantity, e.commander, e.scryfallId])).toEqual([
      ["Sol Ring", 1, false, "33333333-0000-4000-8000-000000000263"],
      ["Dig Through Time", 1, false, "572b3180-9822-4885-b81c-b1bf8aca5a5e"],
      ["Island", 30, false, null],
      ["Teferi, Temporal Archmage", 1, true, "66666666-0000-4000-8000-000000000012"],
    ]);
    expect(deck.skipped.map((s) => s.reason)).toEqual(["Fuera del mazo (sideboard)"]);
  });

  it("acepta también el formato v2", () => {
    const deck = parseMoxfieldDeck(json("moxfield-v2.json"));
    expect(deck.entries.filter((e) => e.commander).map((e) => e.name)).toEqual([
      "Teferi, Temporal Archmage",
    ]);
    expect(deck.entries.reduce((n, e) => n + e.quantity, 0)).toBe(32);
    expect(deck.skipped).toHaveLength(1);
  });

  it("pide la API v3 con el id público", async () => {
    const { client, calls } = http(
      () => new Response(readFixture("deck-sources/moxfield-v3.json")),
    );
    await moxfieldDeckSource(client).load("https://moxfield.com/decks/AbC123_-x");
    expect(calls).toEqual(["https://api2.moxfield.com/v3/decks/all/AbC123_-x"]);
  });

  it("si Moxfield bloquea, avisa sin reintentar y sugiere pegar el texto", async () => {
    const { client, calls } = http(() => new Response("", { status: 403 }));
    const err = await expectSourceError(
      moxfieldDeckSource(client).load("https://moxfield.com/decks/x"),
      "blocked",
    );
    expect(err.message).toMatch(/Moxfield ha rechazado la petición \(HTTP 403\)/);
    expect(calls).toHaveLength(1);
  });

  it("formato desconocido → error de formato", () => {
    expect(() => parseMoxfieldDeck({ hello: 1 })).toThrow(DeckSourceError);
  });
});
