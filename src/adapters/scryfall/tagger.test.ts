import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient, type FetchFn } from "../http/http-client";
import { ScryfallTagger } from "./tagger";
import { TaggerError } from "./tagger-errors";

const PAGE1 = readFixture("scryfall/search-otag-page1.json");
const PAGE2 = readFixture("scryfall/search-otag-page2.json");

const tagger = (fetchFn: FetchFn) =>
  new ScryfallTagger(new HttpClient({ userAgent: "test", minIntervalMs: 0, fetchFn }));

describe("ScryfallTagger", () => {
  it("sigue las páginas y devuelve los oracleIds sin repetir (también de las caras)", async () => {
    const urls: string[] = [];
    const t = tagger(async (url) => {
      urls.push(url);
      return new Response(urls.length === 1 ? PAGE1 : PAGE2);
    });
    expect(await t.cardsWithTag("ramp")).toEqual([
      "00000000-0000-4000-8000-00000000a001",
      "00000000-0000-4000-8000-00000000a002",
      "00000000-0000-4000-8000-00000000a003",
    ]);
    expect(urls[0]).toBe(
      "https://api.scryfall.com/cards/search?q=otag%3Aramp&unique=cards&order=name",
    );
    expect(urls[1]).toContain("page=2");
  });

  it("sin cartas (404) devuelve una lista vacía", async () => {
    const t = tagger(async () => new Response('{"object":"error"}', { status: 404 }));
    expect(await t.cardsWithTag("no-existe")).toEqual([]);
  });

  it("no sigue enlaces fuera de la API de Scryfall", async () => {
    let calls = 0;
    const t = tagger(async () => {
      calls += 1;
      return new Response(PAGE1.replace(/https:\/\/api\.scryfall\.com/, "https://otra.web"));
    });
    expect(await t.cardsWithTag("ramp")).toHaveLength(2);
    expect(calls).toBe(1);
  });

  it("errores tipados: bloqueado, caído y formato", async () => {
    const code = (status: number | "throw" | "bad") =>
      tagger(async () => {
        if (status === "throw") throw new Error("ECONNRESET");
        if (status === "bad") return new Response('{"object":"list","data":"x"}');
        return new Response("", { status });
      })
        .cardsWithTag("ramp")
        .catch((e: unknown) => (e instanceof TaggerError ? e.code : "otro"));
    expect(await code(429)).toBe("blocked");
    expect(await code(503)).toBe("unavailable");
    expect(await code("throw")).toBe("unavailable");
    expect(await code("bad")).toBe("format");
    expect(
      await tagger(async () => new Response("{}"))
        .cardsWithTag("Ramp ;")
        .catch((e: unknown) => (e as TaggerError).code),
    ).toBe("format");
  });
});
