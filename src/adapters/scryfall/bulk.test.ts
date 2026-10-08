import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURES } from "../../../tests/helpers/scryfall-fixtures";
import { HttpClient } from "../http/http-client";
import { ensureBulkFile, readJsonArray, SCRYFALL_BULK_INDEX } from "./bulk";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function tempDir() {
  const d = await mkdtemp(path.join(tmpdir(), "deck-doctor-"));
  dirs.push(d);
  return d;
}

function fakeScryfall(updatedAt: string) {
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
            {
              type: "oracle_cards",
              download_uri: "https://data.scryfall.test/oracle.json",
              updated_at: updatedAt,
            },
          ],
        });
      }
      return new Response('[{"a":1},{"a":2}]');
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
    expect(JSON.parse(await readFile(a.path, "utf8"))).toEqual([{ a: 1 }, { a: 2 }]);

    const same = fakeScryfall("2026-10-01T00:00:00Z");
    expect((await ensureBulkFile(same.http, dir, "oracle_cards")).downloaded).toBe(false);
    expect(same.calls).toEqual([SCRYFALL_BULK_INDEX]);

    const newer = fakeScryfall("2026-10-02T00:00:00Z");
    expect((await ensureBulkFile(newer.http, dir, "oracle_cards")).downloaded).toBe(true);
  });

  it("falla si el tipo no existe", async () => {
    const dir = await tempDir();
    await expect(ensureBulkFile(fakeScryfall("x").http, dir, "default_cards")).rejects.toThrow(
      /no ofrece/,
    );
  });
});
