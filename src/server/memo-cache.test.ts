import { describe, expect, it } from "vitest";
import { MemoCache } from "./memo-cache";

describe("MemoCache", () => {
  it("reutiliza mientras no cambien los datos ni caduque, y comparte cálculos simultáneos", async () => {
    let epoch = 0;
    let now = 0;
    let calls = 0;
    const cache = new MemoCache<number>(
      () => epoch,
      1000,
      2,
      () => now,
    );
    const load = async () => ++calls;
    const [a, b] = await Promise.all([cache.get("ana", load), cache.get("ana", load)]);
    expect([a.value, b.value, calls]).toEqual([1, 1, 1]);
    expect((await cache.get("ana", load)).hit).toBe(true);
    epoch = 1; // alguien ha escrito
    expect(await cache.get("ana", load)).toEqual({ value: 2, hit: false });
    now = 1000; // caducada
    expect((await cache.get("ana", load)).value).toBe(3);
  });

  it("guarda como mucho maxEntries y no guarda los fallos", async () => {
    let calls = 0;
    const cache = new MemoCache<number>(() => 0, 1000, 2);
    const load = async () => ++calls;
    await cache.get("a", load);
    await cache.get("b", load);
    await cache.get("a", load); // "a" es ahora la más reciente
    await cache.get("c", load); // sale "b"
    expect((await cache.get("a", load)).hit).toBe(true);
    expect((await cache.get("b", load)).hit).toBe(false);
    await expect(cache.get("x", () => Promise.reject(new Error("mal")))).rejects.toThrow("mal");
    expect((await cache.get("x", load)).hit).toBe(false);
  });
});
