import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MissingCopiesError,
  ProposalNotPendingError,
  type ProposalItem,
} from "@/domain/ports/trade-proposals";
import { createTestDb, createTestUser } from "../../../tests/helpers/test-db";
import { PrismaCollectionRepository } from "./collection-repository";
import type { Db } from "./prisma";
import { PrismaTradeProposalRepository } from "./trade-proposal-repository";

let db: Db;
let cleanup: () => Promise<void>;
let repo: PrismaTradeProposalRepository;

const item = (giverId: string, oracleId: string, over: Partial<ProposalItem> = {}) => ({
  giverId,
  oracleId,
  scryfallId: null,
  foil: false,
  language: "en",
  quantity: 1,
  unitPrice: 2,
  ...over,
});

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  for (const u of ["ana", "beto", "carla"]) await createTestUser(db, u);
  repo = new PrismaTradeProposalRepository(db);
});
afterAll(async () => cleanup());

describe("PrismaTradeProposalRepository", () => {
  it("borradores solo para quien los crea; versiones como historial", async () => {
    const id = await repo.create({
      fromUserId: "ana",
      toUserId: "beto",
      status: "draft",
      turnUserId: null,
      items: [item("ana", "bolt", { quantity: 2 }), item("beto", "crypt")],
    });
    expect((await repo.listFor("ana")).map((p) => p.id)).toEqual([id]);
    expect(await repo.listFor("beto")).toEqual([]);
    expect((await repo.openBetween("beto", "ana"))?.id).toBeUndefined();

    await repo.update(id, { byUserId: "ana", status: "pending", turnUserId: "beto" });
    expect((await repo.openBetween("beto", "ana"))?.id).toBe(id);

    // Contrapropuesta de Beto: versión 2, le toca a Ana.
    await repo.update(id, {
      items: [item("ana", "bolt", { quantity: 3 })],
      newVersion: true,
      byUserId: "beto",
      status: "pending",
      turnUserId: "ana",
    });
    const p = await repo.get(id);
    expect(p).toMatchObject({ version: 2, lastById: "beto", turnUserId: "ana", status: "pending" });
    expect(p?.items.map((i) => [i.oracleId, i.quantity])).toEqual([["bolt", 3]]);
    // La versión 1 se conserva.
    expect(await db.tradeProposalItem.count({ where: { version: 1 } })).toBe(2);
  });

  it("al aceptar mueve las copias (primero las de esa impresión, con su estado) y si faltan no cambia nada", async () => {
    const ana = new PrismaCollectionRepository(db, "ana");
    const carla = new PrismaCollectionRepository(db, "carla");
    await ana.addCards([
      { oracleId: "ring", name: "Sol Ring", quantity: 2, foil: false, scryfallId: "p-normal" },
      {
        oracleId: "ring",
        name: "Sol Ring",
        quantity: 1,
        foil: true,
        scryfallId: "p-foil",
        condition: "lightly_played",
      },
    ]);
    await carla.addCards([
      { oracleId: "tithe", name: "Smothering Tithe", quantity: 1, foil: false },
    ]);

    const id = await repo.create({
      fromUserId: "ana",
      toUserId: "carla",
      status: "pending",
      turnUserId: "carla",
      items: [
        item("ana", "ring", { scryfallId: "p-foil", foil: true, language: null }),
        item("carla", "tithe", { language: null, quantity: 2 }),
      ],
    });
    // Carla solo tiene 1 Tithe: no se puede aceptar y no se toca nada.
    await expect(repo.accept(id)).rejects.toBeInstanceOf(MissingCopiesError);
    expect((await ana.ownedQuantities()).get("ring")).toBe(3);
    expect((await repo.get(id))?.status).toBe("pending");

    await repo.update(id, {
      items: [
        item("ana", "ring", { scryfallId: "p-foil", foil: true, language: null }),
        item("carla", "tithe", { language: null }),
      ],
      byUserId: "ana",
      status: "pending",
      turnUserId: "carla",
    });
    await repo.accept(id);
    expect(await ana.ownedQuantities()).toEqual(
      new Map([
        ["ring", 2],
        ["tithe", 1],
      ]),
    );
    expect((await ana.entries()).find((e) => e.oracleId === "ring")?.foil).toBe(false);
    const got = (await carla.entries()).find((e) => e.oracleId === "ring");
    expect(got).toMatchObject({
      foil: true,
      scryfallId: "p-foil",
      source: "manual",
      name: "Sol Ring",
      // Llega como estaba.
      condition: "lightly_played",
    });
    expect((await carla.ownedQuantities()).has("tithe")).toBe(false);
    expect((await repo.get(id))?.status).toBe("accepted");

    // Aceptar otra vez (doble clic, otro dispositivo) no vuelve a mover nada.
    await expect(repo.accept(id)).rejects.toBeInstanceOf(ProposalNotPendingError);
    expect((await ana.ownedQuantities()).get("ring")).toBe(2);
    expect((await carla.entries()).filter((e) => e.oracleId === "ring")).toHaveLength(1);
  });
});
