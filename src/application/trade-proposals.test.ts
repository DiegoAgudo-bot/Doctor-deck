import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { PrismaTradeProposalRepository } from "@/adapters/db/trade-proposal-repository";
import { PrismaTradeRepository } from "@/adapters/db/trade-repository";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { ensureUsername } from "./social";
import {
  actOnProposal,
  createProposal,
  myProposals,
  proposalView,
  tradeCalculator,
  TradeProposalError,
  type ProposalLineInput,
} from "./trade-proposals";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;
let cards: PrismaCardRepository;
const id = (name: string) =>
  fixtureCards().find((c) => c.name === name && c.layout !== "token")!.oracleId;
const deps = () => ({
  cards,
  collectionFor: (u: string) => new PrismaCollectionRepository(db, u),
  decksFor: (u: string) => new PrismaDeckRepository(db, u),
  tradesFor: (u: string) => new PrismaTradeRepository(db, u),
  profiles: social,
  notifications: social,
  proposals: new PrismaTradeProposalRepository(db),
});
const add = (user: string, name: string, quantity: number, foil = false) =>
  new PrismaCollectionRepository(db, user).addCards([
    { oracleId: id(name), name, quantity, foil, language: "en" },
  ]);
const line = (side: "give" | "get", name: string, quantity = 1): ProposalLineInput => ({
  side,
  oracleId: id(name),
  scryfallId: null,
  foil: false,
  language: "en",
  quantity,
});
const problem = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof TradeProposalError ? e.problem : String(e)),
  );

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  social = new PrismaSocialRepository(db);
  for (const u of ["ana", "beto", "carla"]) {
    await createTestUser(db, u);
    await ensureUsername(u, { profiles: social });
  }
  // Ana: 2 Sol Ring libres; quiere Mana Crypt. Beto: Mana Crypt y Dig Through Time libres;
  // quiere un Sol Ring. Carla tiene las listas privadas.
  await add("ana", "Sol Ring", 2);
  await new PrismaTradeRepository(db, "ana").setWish(id("Mana Crypt"), 1);
  await add("beto", "Mana Crypt", 1);
  await add("beto", "Dig Through Time", 1);
  await new PrismaTradeRepository(db, "beto").setWish(id("Sol Ring"), 1);
  await add("carla", "Sol Ring", 1);
  for (const u of ["ana", "beto"]) await social.setTradesPublic(u, true);
});
afterAll(async () => cleanup());

describe("calculadora", () => {
  it("propone lo que cruza y no deja un lado vacío", async () => {
    const calc = await tradeCalculator("ana", "BETO", deps());
    expect(calc.partner.username).toBe("beto");
    expect(calc.sides.give.map((c) => [c.oracleId, c.quantity])).toEqual([[id("Sol Ring"), 1]]);
    expect(calc.sides.get.map((c) => [c.oracleId, c.quantity])).toEqual([[id("Mana Crypt"), 1]]);
    // Puede añadir a mano cualquier carta que el otro tenga para cambiar.
    expect(calc.theirCopies.map((c) => c.oracleId).sort()).toEqual(
      [id("Mana Crypt"), id("Dig Through Time")].sort(),
    );
    expect(calc.openProposalId).toBeNull();
  });

  it("no con quien tiene las listas privadas ni consigo mismo", async () => {
    expect(await problem(tradeCalculator("ana", "carla", deps()))).toBe("private");
    expect(await problem(tradeCalculator("ana", "ana", deps()))).toBe("self");
    expect(await problem(tradeCalculator("ana", "nadie", deps()))).toBe("not_found");
  });
});

describe("propuestas", () => {
  it("borrador → enviar → contrapropuesta → aceptar, moviendo las cartas", async () => {
    // Una carta que Beto no tiene para cambiar no se puede pedir.
    expect(
      await problem(
        createProposal(
          "ana",
          { username: "beto", lines: [line("get", "Sol Ring")], send: false },
          deps(),
        ),
      ),
    ).toBe("unavailable");

    const pid = await createProposal(
      "ana",
      {
        username: "beto",
        lines: [line("give", "Sol Ring"), line("get", "Mana Crypt")],
        send: false,
      },
      deps(),
    );
    // El borrador no lo ve Beto.
    expect(await problem(proposalView("beto", pid, deps()))).toBe("not_found");
    await actOnProposal("ana", pid, { action: "send" }, deps());
    const notes = await social.list("beto", 10);
    expect(notes[0]).toMatchObject({ type: "trade_proposal", tradeId: pid, actorId: "ana" });

    // A Ana no le toca: no puede aceptar su propia propuesta.
    expect(await problem(actOnProposal("ana", pid, { action: "accept" }, deps()))).toBe(
      "not_your_turn",
    );

    // Beto contrapropone: además quiere el segundo Sol Ring y da también Dig Through Time.
    const view = await proposalView("beto", pid, deps());
    expect(view.actions).toEqual({ edit: false, respond: true, cancel: true });
    expect(view.sides.get.map((c) => c.oracleId)).toEqual([id("Sol Ring")]);
    await actOnProposal(
      "beto",
      pid,
      {
        action: "counter",
        lines: [
          line("give", "Mana Crypt"),
          line("give", "Dig Through Time"),
          line("get", "Sol Ring", 2),
        ],
      },
      deps(),
    );
    expect((await social.list("ana", 10))[0]).toMatchObject({ type: "trade_counter" });

    const forAna = await proposalView("ana", pid, deps());
    expect(forAna.proposal.version).toBe(2);
    expect(forAna.sides.give.map((c) => [c.oracleId, c.quantity])).toEqual([[id("Sol Ring"), 2]]);
    await actOnProposal("ana", pid, { action: "accept" }, deps());

    const ana = await new PrismaCollectionRepository(db, "ana").ownedQuantities();
    const beto = await new PrismaCollectionRepository(db, "beto").ownedQuantities();
    expect(ana.has(id("Sol Ring"))).toBe(false);
    expect(ana.get(id("Mana Crypt"))).toBe(1);
    expect(ana.get(id("Dig Through Time"))).toBe(1);
    expect(beto.get(id("Sol Ring"))).toBe(2);
    expect(beto.has(id("Mana Crypt"))).toBe(false);
    expect((await social.list("beto", 10))[0]).toMatchObject({ type: "trade_accepted" });
    // Lo recibido sale de la lista de deseos manual.
    expect(await new PrismaTradeRepository(db, "ana").wishes()).toEqual([]);
    expect(await new PrismaTradeRepository(db, "beto").wishes()).toEqual([]);

    // Cerrada: ya no se puede tocar.
    expect(await problem(actOnProposal("beto", pid, { action: "cancel" }, deps()))).toBe("closed");
    const list = await myProposals("ana", deps());
    expect(list.map((l) => [l.proposal.status, l.partner.username])).toEqual([
      ["accepted", "beto"],
    ]);
  });

  it("rechazar y retirar avisan a la otra persona", async () => {
    // Ahora Beto tiene los Sol Ring y Ana el Mana Crypt.
    await new PrismaTradeRepository(db, "beto").setWish(id("Mana Crypt"), 1);
    const pid = await createProposal(
      "ana",
      {
        username: "beto",
        lines: [line("give", "Mana Crypt"), line("get", "Sol Ring")],
        send: true,
      },
      deps(),
    );
    // Si Ana mete el Mana Crypt en un mazo, ya no está para cambiar: Beto no puede aceptar.
    const deck = await new PrismaDeckRepository(db, "ana").save({
      name: "Con Crypt",
      input: "",
      source: "text",
      theme: null,
      commanders: [{ oracleId: id("Teferi, Temporal Archmage"), name: "Teferi" }],
      cards: [{ oracleId: id("Mana Crypt"), quantity: 1 }],
      locked: [],
      excluded: [],
    });
    expect(await problem(actOnProposal("beto", pid, { action: "accept" }, deps()))).toBe(
      "unavailable",
    );
    await new PrismaDeckRepository(db, "ana").delete(deck);
    await actOnProposal("beto", pid, { action: "reject" }, deps());
    expect((await social.list("ana", 10))[0]).toMatchObject({ type: "trade_rejected" });

    const other = await createProposal(
      "ana",
      { username: "beto", lines: [line("give", "Mana Crypt")], send: true },
      deps(),
    );
    expect((await tradeCalculator("ana", "beto", deps())).openProposalId).toBe(other);
    await actOnProposal("ana", other, { action: "cancel" }, deps());
    expect((await social.list("beto", 10))[0]).toMatchObject({ type: "trade_cancelled" });
  });
});
