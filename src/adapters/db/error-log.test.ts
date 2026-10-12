import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../../tests/helpers/test-db";
import { PrismaErrorLog } from "./error-log";
import type { Db } from "./prisma";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(() => {
  ({ db, cleanup } = createTestDb());
});
afterAll(async () => cleanup());

describe("PrismaErrorLog", () => {
  it("agrupa los repetidos, ordena por el último y se puede vaciar", async () => {
    const log = new PrismaErrorLog(db);
    await log.record({ source: "client", message: "Falla 1", path: "/a" }, new Date("2026-10-01"));
    await log.record({ source: "client", message: "Falla 2", path: "/a" }, new Date("2026-10-02"));
    await log.record({ source: "server", message: "Otra", path: "/api/x" }, new Date("2026-10-03"));
    const list = await log.list(10);
    expect(list.map((e) => [e.source, e.count, e.message])).toEqual([
      ["server", 1, "Otra"],
      ["client", 2, "Falla 2"],
    ]);
    expect(list[1]?.firstAt).toEqual(new Date("2026-10-01"));
    await log.clear(list[0]?.id);
    expect(await log.list(10)).toHaveLength(1);
    await log.clear();
    expect(await log.list(10)).toHaveLength(0);
  });
});
