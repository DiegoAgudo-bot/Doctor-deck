import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "../../../tests/helpers/test-db";
import type { Db } from "./prisma";
import { PrismaRoleOverrideRepository } from "./role-override-repository";

let db: Db;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  await createTestUser(db, "ana");
  await createTestUser(db, "beto");
});
afterAll(async () => cleanup());

describe("PrismaRoleOverrideRepository", () => {
  it("guarda, cambia y borra por usuario", async () => {
    const ana = new PrismaRoleOverrideRepository(db, "ana");
    await ana.set("sol", { override: { roles: ["ramp"], primary: "ramp" }, tags: ["base"] });
    await ana.set("tag", { override: null, tags: ["wincon"] });
    expect(await ana.all()).toEqual(
      new Map([
        ["sol", { override: { roles: ["ramp"], primary: "ramp" }, tags: ["base"] }],
        ["tag", { override: null, tags: ["wincon"] }],
      ]),
    );
    expect((await new PrismaRoleOverrideRepository(db, "beto").all()).size).toBe(0);

    await ana.set("sol", { override: { roles: ["ramp", "draw"], primary: "draw" }, tags: [] });
    expect((await ana.all()).get("sol")).toEqual({
      override: { roles: ["ramp", "draw"], primary: "draw" },
      tags: [],
    });
    // Sin roles ni etiquetas: se borra (vuelve a lo automático).
    await ana.set("tag", { override: null, tags: [] });
    expect((await ana.all()).has("tag")).toBe(false);
  });
});
