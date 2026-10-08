import { describe, expect, it } from "vitest";
import { readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient } from "../http/http-client";
import { MemoryResponseCache } from "../http/memory-cache";
import { EdhrecClient } from "./edhrec-client";
import { EdhrecError } from "./errors";

const BASE = "https://json.edhrec.com/pages";
const HOUR = 3_600_000;
const T0 = new Date("2026-10-08T12:00:00Z");

type Route = string | number | Error; // cuerpo, status HTTP o fallo de red

function setup(routes: Record<string, Route>) {
  const calls: string[] = [];
  let now = T0;
  const http = new HttpClient({
    userAgent: "DeckDoctor/test",
    minIntervalMs: 0,
    clock: { now: () => 0, sleep: async () => undefined },
    fetchFn: async (url) => {
      calls.push(url);
      const r = routes[url.replace(BASE, "")];
      if (r === undefined) return new Response("not found", { status: 404 });
      if (r instanceof Error) throw r;
      if (typeof r === "number") return new Response("", { status: r });
      return new Response(r, { status: 200 });
    },
  });
  const cache = new MemoryResponseCache();
  const client = new EdhrecClient({ http, cache, ttlMs: 24 * HOUR, now: () => now });
  return {
    client,
    cache,
    calls,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    routes,
  };
}

const TEFERI = readFixture("edhrec/teferi-temporal-archmage.json");
const TEFERI_CONTROL = readFixture("edhrec/teferi-temporal-archmage-control.json");

async function expectEdhrecError(p: Promise<unknown>, code: EdhrecError["code"]) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(EdhrecError);
  expect((err as EdhrecError).code).toBe(code);
  return err as EdhrecError;
}

describe("EdhrecClient", () => {
  it("pide la página del comandante por su slug", async () => {
    const { client, calls } = setup({ "/commanders/teferi-temporal-archmage.json": TEFERI });
    const recs = await client.getRecommendations({ commanders: ["Teferi, Temporal Archmage"] });
    expect(calls).toEqual([`${BASE}/commanders/teferi-temporal-archmage.json`]);
    expect(recs).toMatchObject({
      commanderSlug: "teferi-temporal-archmage",
      theme: null,
      totalDecks: 4000,
      stale: false,
      warning: null,
      fetchedAt: T0,
    });
    expect(recs.cards.length).toBeGreaterThan(5);
  });

  it("pide la variante por tema", async () => {
    const { client, calls } = setup({
      "/commanders/teferi-temporal-archmage/control.json": TEFERI_CONTROL,
    });
    const recs = await client.getRecommendations({
      commanders: ["Teferi, Temporal Archmage"],
      theme: "control",
    });
    expect(calls).toEqual([`${BASE}/commanders/teferi-temporal-archmage/control.json`]);
    expect(recs.theme).toBe("control");
    expect(recs.totalDecks).toBe(812);
  });

  it("usa la caché durante el TTL y vuelve a pedir al caducar", async () => {
    const { client, calls, advance } = setup({
      "/commanders/teferi-temporal-archmage.json": TEFERI,
    });
    const q = { commanders: ["Teferi, Temporal Archmage"] };
    await client.getRecommendations(q);
    advance(23 * HOUR);
    const cached = await client.getRecommendations(q);
    expect(calls).toHaveLength(1);
    expect(cached.fetchedAt).toEqual(T0);

    advance(2 * HOUR);
    const fresh = await client.getRecommendations(q);
    expect(calls).toHaveLength(2);
    expect(fresh.fetchedAt.getTime()).toBe(T0.getTime() + 25 * HOUR);
  });

  it("sigue una redirección de EDHREC (una sola vez)", async () => {
    const { client, calls } = setup({
      "/commanders/teferi.json": readFixture("edhrec/redirect.json"),
      "/commanders/teferi-temporal-archmage.json": TEFERI,
    });
    const recs = await client.getRecommendations({ commanders: ["Teferi"] });
    expect(calls.map((c) => c.replace(BASE, ""))).toEqual([
      "/commanders/teferi.json",
      "/commanders/teferi-temporal-archmage.json",
    ]);
    expect(recs.totalDecks).toBe(4000);
  });

  it("corta bucles de redirección", async () => {
    const loop = '{"redirect":"/commanders/a"}';
    const { client } = setup({ "/commanders/a.json": loop });
    await expectEdhrecError(client.getRecommendations({ commanders: ["A"] }), "format");
  });

  it("404 → not_found", async () => {
    const { client } = setup({});
    await expectEdhrecError(client.getRecommendations({ commanders: ["Nadie"] }), "not_found");
  });

  it("403 / 429 → blocked, sin reintentos", async () => {
    for (const status of [403, 429]) {
      const { client, calls } = setup({ "/commanders/teferi-temporal-archmage.json": status });
      const err = await expectEdhrecError(
        client.getRecommendations({ commanders: ["Teferi, Temporal Archmage"] }),
        "blocked",
      );
      expect(err.message).toMatch(String(status));
      expect(calls).toHaveLength(1);
    }
  });

  it("errores 5xx o de red sin caché → unavailable", async () => {
    const { client } = setup({ "/commanders/teferi-temporal-archmage.json": 503 });
    await expectEdhrecError(
      client.getRecommendations({ commanders: ["Teferi, Temporal Archmage"] }),
      "unavailable",
    );
    const net = setup({
      "/commanders/teferi-temporal-archmage.json": new TypeError("fetch failed"),
    });
    await expectEdhrecError(
      net.client.getRecommendations({ commanders: ["Teferi, Temporal Archmage"] }),
      "unavailable",
    );
  });

  it("si EDHREC falla y hay caché caducada, la devuelve marcada como stale con aviso", async () => {
    const env = setup({ "/commanders/teferi-temporal-archmage.json": TEFERI });
    const q = { commanders: ["Teferi, Temporal Archmage"] };
    await env.client.getRecommendations(q);
    env.advance(48 * HOUR);
    env.routes["/commanders/teferi-temporal-archmage.json"] = 429;
    const recs = await env.client.getRecommendations(q);
    expect(recs.stale).toBe(true);
    expect(recs.fetchedAt).toEqual(T0);
    expect(recs.warning).toMatch(/2026-10-08/);
    expect(recs.warning).toMatch(/429/);
  });

  it("no cachea respuestas con formato inesperado", async () => {
    const { client, cache } = setup({
      "/commanders/teferi-temporal-archmage.json": readFixture("edhrec/changed-format.json"),
    });
    await expectEdhrecError(
      client.getRecommendations({ commanders: ["Teferi, Temporal Archmage"] }),
      "format",
    );
    expect(cache.entries.size).toBe(0);
  });

  it("valida la consulta", async () => {
    const { client, calls } = setup({});
    await expectEdhrecError(client.getRecommendations({ commanders: [] }), "invalid_query");
    await expectEdhrecError(
      client.getRecommendations({ commanders: ["A", "B", "C"] }),
      "invalid_query",
    );
    await expectEdhrecError(
      client.getRecommendations({ commanders: ["A"], theme: "../../cards/x" }),
      "invalid_query",
    );
    expect(calls).toEqual([]);
  });

  it("parejas de comandantes usan un slug combinado", async () => {
    const { client, calls } = setup({});
    await client
      .getRecommendations({ commanders: ["Tymna the Weaver", "Thrasios, Triton Hero"] })
      .catch(() => undefined);
    expect(calls).toEqual([`${BASE}/commanders/thrasios-triton-hero-tymna-the-weaver.json`]);
  });
});
