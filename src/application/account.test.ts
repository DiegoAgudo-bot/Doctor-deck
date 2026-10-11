import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaRoleOverrideRepository } from "@/adapters/db/role-override-repository";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { PrismaTradeProposalRepository } from "@/adapters/db/trade-proposal-repository";
import { PrismaTradeRepository } from "@/adapters/db/trade-repository";
import { PrismaLoanRepository } from "@/adapters/db/loan-repository";
import { PrismaModerationRepository } from "@/adapters/db/moderation-repository";
import { PrismaGameRepository, PrismaGroupRepository } from "@/adapters/db/play-repository";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { AccountConfirmationError, deleteAccount, exportMyData } from "./account";
import { ensureUsername } from "./social";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  social = new PrismaSocialRepository(db);
  for (const u of ["ana", "beto"]) {
    await createTestUser(db, u);
    await ensureUsername(u, { profiles: social });
  }
  await new PrismaCollectionRepository(db, "ana").addCards([
    {
      oracleId: "sol",
      name: "Sol Ring",
      quantity: 2,
      foil: true,
      language: "es",
      condition: "near_mint",
    },
  ]);
  await new PrismaDeckRepository(db, "ana").save({
    name: "Teferi",
    input: "1 Teferi\n1 Sol Ring",
    source: "text",
    theme: null,
    commanders: [{ oracleId: "teferi", name: "Teferi" }],
    cards: [{ oracleId: "sol", quantity: 1 }],
    locked: [],
    excluded: [],
  });
  await new PrismaTradeRepository(db, "ana").setWish("crypt", 1);
  await social.follow("ana", "beto");
  await new PrismaTradeProposalRepository(db).create({
    fromUserId: "ana",
    toUserId: "beto",
    status: "pending",
    turnUserId: "beto",
    items: [
      {
        giverId: "ana",
        oracleId: "sol",
        scryfallId: null,
        foil: true,
        language: "es",
        quantity: 1,
        unitPrice: 1,
      },
    ],
  });
});
afterAll(async () => cleanup());

const deps = (u: string) => ({
  profiles: social,
  follows: social,
  collection: new PrismaCollectionRepository(db, u),
  decks: new PrismaDeckRepository(db, u),
  trades: new PrismaTradeRepository(db, u),
  roleOverrides: new PrismaRoleOverrideRepository(db, u),
  proposals: new PrismaTradeProposalRepository(db),
  groups: new PrismaGroupRepository(db),
  games: new PrismaGameRepository(db),
  loans: new PrismaLoanRepository(db),
  comments: new PrismaModerationRepository(db),
  blocks: new PrismaModerationRepository(db),
});

describe("mis datos", () => {
  it("los exporta todos, con la gente por su nombre de usuario y sin ids internos", async () => {
    const data = await exportMyData("ana", deps("ana"), new Date("2026-10-12T00:00:00Z"));
    expect(data.profile).toMatchObject({ username: "ana", email: "ana@test.local" });
    expect(data.collection).toEqual([
      expect.objectContaining({
        name: "Sol Ring",
        quantity: 2,
        foil: true,
        language: "es",
        condition: "near_mint",
      }),
    ]);
    expect(data.collection[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.decks.map((d) => [d.name, d.list])).toEqual([["Teferi", "1 Teferi\n1 Sol Ring"]]);
    expect(data.wishlist).toEqual([{ oracleId: "crypt", quantity: 1 }]);
    expect(data.following).toEqual(["beto"]);
    expect(data.tradeProposals[0]).toMatchObject({ from: "yo", to: "beto", status: "pending" });
    expect(data.tradeProposals[0]?.items[0]).toMatchObject({ gives: "yo", oracleId: "sol" });
    expect(JSON.stringify(data)).not.toContain('"giverId"');
    expect(data).toMatchObject({ groups: [], games: [], loans: [], comments: [], blocked: [] });
  });
});

describe("borrar la cuenta", () => {
  it("exige escribir el email y lo borra todo en cascada", async () => {
    await expect(
      deleteAccount("ana", "otra@test.local", { profiles: social }),
    ).rejects.toBeInstanceOf(AccountConfirmationError);
    await deleteAccount("ana", " ANA@test.local ", { profiles: social });
    expect(await db.user.count({ where: { id: "ana" } })).toBe(0);
    expect(await db.collectionEntry.count({ where: { userId: "ana" } })).toBe(0);
    expect(await db.deck.count({ where: { userId: "ana" } })).toBe(0);
    expect(await db.tradeProposal.count()).toBe(0);
    expect(await db.follow.count()).toBe(0);
    // A los demás no les pasa nada.
    expect(await db.user.count({ where: { id: "beto" } })).toBe(1);
  });
});
