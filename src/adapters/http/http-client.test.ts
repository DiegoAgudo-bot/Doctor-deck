import { describe, expect, it } from "vitest";
import { HttpClient, HttpError, NetworkError } from "./http-client";
import { RateLimiter, type Clock } from "./rate-limiter";

function fakeClock(): Clock & { sleeps: number[] } {
  let t = 1000;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
  };
}

describe("RateLimiter", () => {
  it("espera el intervalo mínimo entre llamadas, aunque se lancen a la vez", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(100, clock);
    const times: number[] = [];
    await Promise.all([1, 2, 3].map(() => limiter.schedule(async () => times.push(clock.now()))));
    expect(times).toEqual([1000, 1100, 1200]);
    expect(clock.sleeps).toEqual([100, 100]);
  });

  it("un error en una tarea no bloquea las siguientes", async () => {
    const limiter = new RateLimiter(10, fakeClock());
    await expect(limiter.schedule(async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    await expect(limiter.schedule(async () => "ok")).resolves.toBe("ok");
  });
});

describe("HttpClient", () => {
  it("envía User-Agent y Accept", async () => {
    let seen: RequestInit | undefined;
    const client = new HttpClient({
      userAgent: "DeckDoctor/test",
      minIntervalMs: 0,
      clock: fakeClock(),
      fetchFn: async (_url, init) => {
        seen = init;
        return new Response('{"ok":true}', { status: 200 });
      },
    });
    await expect(client.getJson("https://example.test/x")).resolves.toEqual({ ok: true });
    expect(seen?.headers).toMatchObject({ "User-Agent": "DeckDoctor/test" });
  });

  it("lanza HttpError en respuestas no 2xx", async () => {
    const client = new HttpClient({
      userAgent: "u",
      minIntervalMs: 0,
      clock: fakeClock(),
      fetchFn: async () => new Response("nope", { status: 404 }),
    });
    await expect(client.get("https://example.test/404")).rejects.toBeInstanceOf(HttpError);
  });

  it("envuelve los fallos de conexión en NetworkError con la causa", async () => {
    const client = new HttpClient({
      userAgent: "u",
      minIntervalMs: 0,
      clock: fakeClock(),
      fetchFn: async () => {
        throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND") });
      },
    });
    const err = await client.get("https://example.test/").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as Error).message).toMatch(/ENOTFOUND/);
  });
});
