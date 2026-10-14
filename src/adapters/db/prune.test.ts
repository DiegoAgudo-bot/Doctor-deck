import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "../../../tests/helpers/test-db";
import type { Db } from "./prisma";
import { pruneOldData } from "./prune";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(() => ({ db, cleanup } = createTestDb()));
afterAll(async () => cleanup());

describe("pruneOldData", () => {
  it("borra solo lo viejo", async () => {
    const now = new Date("2026-10-14T00:00:00Z");
    const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
    await db.httpCache.createMany({
      data: [
        { url: "old", status: 200, body: "{}", fetchedAt: ago(40) },
        { url: "new", status: 200, body: "{}", fetchedAt: ago(2) },
      ],
    });
    const u = await createTestUser(db, "prune-user");
    const n = (createdAt: Date, readAt: Date | null) => ({
      userId: u,
      actorId: u,
      type: "new_deck",
      title: "x",
      createdAt,
      readAt,
    });
    await db.notification.createMany({
      data: [n(ago(100), ago(99)), n(ago(100), null), n(ago(400), null), n(ago(1), ago(1))],
    });
    await db.priceSnapshot.createMany({
      data: [
        { oracleId: "a", date: "2025-01-01", eur: 1 },
        { oracleId: "a", date: "2026-10-01", eur: 1 },
      ],
    });
    expect(await pruneOldData(db, now)).toEqual({ cache: 1, notifications: 2, prices: 1 });
    expect((await db.httpCache.findMany()).map((r) => r.url)).toEqual(["new"]);
    expect(await db.notification.count()).toBe(2);
  });
});
