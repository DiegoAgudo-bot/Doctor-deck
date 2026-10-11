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

describe("correcciones solo en un mazo", () => {
  it("solo el dueño del mazo las guarda y las lee; se borran con el mazo", async () => {
    const deck = await db.deck.create({ data: { userId: "ana", name: "Mazo de Ana" } });
    const ana = new PrismaRoleOverrideRepository(db, "ana");
    const beto = new PrismaRoleOverrideRepository(db, "beto");
    const edit = {
      override: { roles: ["removal" as const], primary: "removal" as const },
      tags: [],
    };

    expect(await beto.setForDeck(deck.publicId, "sol", edit)).toBe(false);
    expect(await ana.setForDeck("no-existe", "sol", edit)).toBe(false);
    expect(await ana.setForDeck(deck.publicId, "sol", edit)).toBe(true);
    expect(await ana.forDeck(deck.publicId)).toEqual(new Map([["sol", edit]]));
    expect((await beto.forDeck(deck.publicId)).size).toBe(0);
    // No se mezclan con las de todos mis mazos.
    expect((await ana.all()).get("sol")?.override?.primary).not.toBe("removal");

    await ana.setForDeck(deck.publicId, "sol", { override: null, tags: [] });
    expect((await ana.forDeck(deck.publicId)).size).toBe(0);

    await ana.setForDeck(deck.publicId, "sol", edit);
    await db.deck.delete({ where: { id: deck.id } });
    expect(await db.deckRoleOverride.count()).toBe(0);
  });
});
