import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../tests/helpers/test-db";
import type { Db } from "./prisma";
import { PrismaResponseCache } from "./response-cache";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(() => {
  ({ db, cleanup } = createTestDb());
});
afterAll(async () => cleanup());

describe("PrismaResponseCache", () => {
  it("guarda, lee y sobrescribe", async () => {
    const cache = new PrismaResponseCache(db);
    expect(await cache.get("u")).toBeNull();
    const t1 = new Date("2026-10-01T00:00:00Z");
    await cache.set("u", { body: "uno", fetchedAt: t1 });
    expect(await cache.get("u")).toEqual({ body: "uno", fetchedAt: t1 });
    const t2 = new Date("2026-10-02T00:00:00Z");
    await cache.set("u", { body: "dos", fetchedAt: t2 });
    expect(await cache.get("u")).toEqual({ body: "dos", fetchedAt: t2 });
  });
});
