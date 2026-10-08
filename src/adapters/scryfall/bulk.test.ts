import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURES } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient } from "../http/http-client";
import { ensureBulkFile, readBulkFile, readJsonArray, SCRYFALL_BULK_INDEX } from "./bulk";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function tempDir() {
  const d = await mkdtemp(path.join(tmpdir(), "deck-doctor-"));
  dirs.push(d);
  return d;
}

async function collect(items: AsyncIterable<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const item of items) out.push(item);
  return out;
}

/** Índice con el formato actual de Scryfall (JSON Lines comprimido) o el antiguo (array JSON). */
function fakeScryfall(updatedAt: string, format: "jsonl" | "json" = "jsonl") {
  const calls: string[] = [];
  const http = new HttpClient({
    userAgent: "test",
    minIntervalMs: 0,
    clock: { now: () => 0, sleep: async () => undefined },
    fetchFn: async (url) => {
      calls.push(url);
      if (url === SCRYFALL_BULK_INDEX) {
        return Response.json({
          data: [
            format === "jsonl"
              ? {
                  type: "oracle_cards",
                  jsonl_download_uri: "https://data.scryfall.test/oracle.jsonl.gz",
                  updated_at: updatedAt,
                }
              : {
                  type: "oracle_cards",
                  download_uri: "https://data.scryfall.test/oracle.json",
                  updated_at: updatedAt,
                },
          ],
        });
      }
      return new Response(
        format === "jsonl" ? gzipSync('{"a":1}\n{"a":2}\n') : '[{"a":1},{"a":2}]',
      );
    },
  });
  return { http, calls };
}

describe("readJsonArray", () => {
  it("recorre los elementos de un array JSON en streaming", async () => {
    const names: string[] = [];
    for await (const item of readJsonArray(
      path.join(FIXTURES, "scryfall/oracle_cards.sample.json"),
    )) {
      names.push((item as { name: string }).name);
    }
    expect(names).toContain("Sol Ring");
    expect(names.length).toBeGreaterThan(10);
  });
});

describe("ensureBulkFile", () => {
  it("descarga solo cuando cambia updated_at", async () => {
    const dir = await tempDir();
    const first = fakeScryfall("2026-10-01T00:00:00Z");
    const a = await ensureBulkFile(first.http, dir, "oracle_cards");
    expect(a.downloaded).toBe(true);
    expect(a.path).toMatch(/oracle_cards\.jsonl\.gz$/);
    expect(await collect(readBulkFile(a.path))).toEqual([{ a: 1 }, { a: 2 }]);

    const same = fakeScryfall("2026-10-01T00:00:00Z");
    expect((await ensureBulkFile(same.http, dir, "oracle_cards")).downloaded).toBe(false);
    expect(same.calls).toEqual([SCRYFALL_BULK_INDEX]);

    const newer = fakeScryfall("2026-10-02T00:00:00Z");
    expect((await ensureBulkFile(newer.http, dir, "oracle_cards")).downloaded).toBe(true);
  });

  it("admite el formato antiguo (download_uri con un array JSON)", async () => {
    const dir = await tempDir();
    const f = await ensureBulkFile(fakeScryfall("x", "json").http, dir, "oracle_cards");
    expect(f.path).toMatch(/oracle_cards\.json$/);
    expect(JSON.parse(await readFile(f.path, "utf8"))).toEqual([{ a: 1 }, { a: 2 }]);
    expect(await collect(readBulkFile(f.path))).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("falla si el tipo no existe", async () => {
    const dir = await tempDir();
    await expect(ensureBulkFile(fakeScryfall("x").http, dir, "default_cards")).rejects.toThrow(
      /no ofrece/,
    );
  });
});
