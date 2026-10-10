import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpClient } from "../http/http-client";
import { FileImageCache } from "./image-cache";

const IMG = "normal/front/8/e/8ee443cc-e17a-493b-9c93-1f9e141a30e4.jpg";
const OTHER = "normal/front/0/1/01234567-89ab-cdef-0123-456789abcdef.jpg";
let dir: string;
let calls: string[];
let online: boolean;

const http = () =>
  new HttpClient({
    userAgent: "test",
    minIntervalMs: 0,
    fetchFn: async (url) => {
      calls.push(url);
      if (!online) throw new Error("bloqueado");
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
    },
  });

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dd-img-"));
  calls = [];
  online = true;
});
afterEach(async () => rm(dir, { recursive: true, force: true }));

describe("FileImageCache", () => {
  it("la primera vez la pide a Scryfall y la guarda; después sale de disco", async () => {
    const cache = new FileImageCache(dir, 1_000_000, http());
    expect(await cache.get(IMG)).toMatchObject({ cached: false, contentType: "image/jpeg" });
    expect(calls).toEqual([`https://cards.scryfall.io/${IMG}`]);
    expect([...(await readFile(path.join(dir, IMG)))]).toEqual([1, 2, 3, 4]);

    // Scryfall caído (p. ej. bloqueos de LaLiga): la guardada sigue saliendo.
    online = false;
    expect(await cache.get(IMG)).toMatchObject({ cached: true });
    expect(await cache.get(OTHER)).toBeNull();
  });

  it("no pide nada que no sea una ruta de imagen de Scryfall", async () => {
    const cache = new FileImageCache(dir, 1_000_000, http());
    expect(await cache.get("../../etc/passwd")).toBeNull();
    expect(calls).toEqual([]);
  });

  it("con la caché llena sirve las nuevas sin guardarlas", async () => {
    const cache = new FileImageCache(dir, 5, http());
    await cache.get(IMG);
    expect(await cache.get(OTHER)).toMatchObject({ cached: false });
    await expect(readFile(path.join(dir, OTHER))).rejects.toThrow();
  });
});
