import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaCollectionRepository } from "@/adapters/db/collection-repository";
import { PrismaDeckRepository, PrismaPublicDecks } from "@/adapters/db/deck-repository";
import { PrismaFeedSource } from "@/adapters/db/feed-repository";
import { PrismaLoanRepository } from "@/adapters/db/loan-repository";
import { PrismaModerationRepository } from "@/adapters/db/moderation-repository";
import { PrismaGameRepository, PrismaGroupRepository } from "@/adapters/db/play-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { PrismaTradeRepository } from "@/adapters/db/trade-repository";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import {
  addComment,
  deckComments,
  deleteComment,
  moderateComment,
  reportComment,
  setBlocked,
} from "./comments";
import { AppError } from "./errors";
import { activityFeed } from "./feed";
import { deleteGame, gameStats, getGame, recordGame } from "./games";
import {
  createGroup,
  groupCanLend,
  groupDecks,
  groupHolders,
  invitePreview,
  joinGroup,
  memberGroup,
  removeMember,
} from "./groups";
import { closeLoan, lendCard, myLoans } from "./loans";
import { ensureUsername, setFollowing } from "./social";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;
let cards: PrismaCardRepository;
let moderation: PrismaModerationRepository;
const id = (name: string) =>
  fixtureCards().find((c) => c.name === name && c.layout !== "token")!.oracleId;

const deps = () => ({
  cards,
  collectionFor: (u: string) => new PrismaCollectionRepository(db, u),
  decksFor: (u: string) => new PrismaDeckRepository(db, u),
  tradesFor: (u: string) => new PrismaTradeRepository(db, u),
  profiles: social,
  follows: social,
  notifications: social,
  publicDecks: new PrismaPublicDecks(db),
  groups: new PrismaGroupRepository(db),
  games: new PrismaGameRepository(db),
  loans: new PrismaLoanRepository(db),
  feed: new PrismaFeedSource(db),
  comments: moderation,
  blocks: moderation,
  reports: moderation,
});
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof AppError ? e.code : String(e)),
  );
const saveDeck = (user: string, name: string, visibility: "public" | "unlisted" | "private") =>
  new PrismaDeckRepository(db, user).save({
    name,
    input: "",
    source: "text",
    theme: null,
    commanders: [{ oracleId: id("Teferi, Temporal Archmage"), name: "Teferi, Temporal Archmage" }],
    cards: [{ oracleId: id("Sol Ring"), quantity: 1 }],
    locked: [],
    excluded: [],
    visibility,
  });

let groupId = "";
let anaDeck = "";
let betoDeck = "";

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
  social = new PrismaSocialRepository(db);
  moderation = new PrismaModerationRepository(db);
  for (const u of ["ana", "beto", "carla", "dani"]) {
    await createTestUser(db, u);
    await ensureUsername(u, { profiles: social });
  }
  await new PrismaCollectionRepository(db, "beto").addCards([
    { oracleId: id("Mana Crypt"), name: "Mana Crypt", quantity: 1, foil: false, language: "en" },
    { oracleId: id("Sol Ring"), name: "Sol Ring", quantity: 3, foil: false, language: "en" },
  ]);
  anaDeck = await saveDeck("ana", "Teferi de Ana", "public");
  betoDeck = await saveDeck("beto", "Teferi oculto", "unlisted");
  await saveDeck("beto", "Privado", "private");
  await new PrismaTradeRepository(db, "ana").setWish(id("Mana Crypt"), 1);
});
afterAll(async () => cleanup());

describe("grupos", () => {
  it("se crea, se entra con el enlace y solo lo ven los miembros", async () => {
    groupId = await createGroup("ana", { name: "  Los  del jueves " }, deps());
    const g = await memberGroup(groupId, "ana", deps());
    expect(g.name).toBe("Los del jueves");
    expect(await code(memberGroup(groupId, "beto", deps()))).toBe("not_found");

    expect((await invitePreview(g.inviteCode, "beto", deps())).member).toBe(false);
    expect(await joinGroup(g.inviteCode, "beto", deps())).toBe(groupId);
    await joinGroup(g.inviteCode, "carla", deps());
    expect((await memberGroup(groupId, "beto", deps())).members.map((m) => m.id)).toEqual([
      "ana",
      "beto",
      "carla",
    ]);
    // A Ana le llega el aviso.
    expect((await social.list("ana", 10)).map((n) => n.type)).toContain("group_join");
    expect(await code(invitePreview("nope", null, deps()))).toBe("not_found");
  });

  it("mazos públicos y ocultos de los miembros, no los privados", async () => {
    const g = await memberGroup(groupId, "ana", deps());
    expect((await groupDecks(g, deps())).map((d) => d.name).sort()).toEqual([
      "Teferi de Ana",
      "Teferi oculto",
    ]);
  });

  it("quién tiene qué: copias libres y lo que me pueden dejar", async () => {
    const g = await memberGroup(groupId, "ana", deps());
    const holders = await groupHolders(g, [id("Sol Ring")], deps());
    // Beto: 3, una en su mazo oculto y otra en el privado → 1 libre.
    expect(holders.get(id("Sol Ring"))?.map((h) => [h.member.id, h.owned, h.free])).toEqual([
      ["beto", 3, 1],
    ]);
    const lend = await groupCanLend(g, "ana", deps());
    // Ana quiere Mana Crypt (lista de deseos) y le falta Sol Ring para su mazo.
    expect(lend.map((l) => [l.oracleId, l.holders.map((h) => h.member.id)]).sort()).toEqual(
      [
        [id("Mana Crypt"), ["beto"]],
        [id("Sol Ring"), ["beto"]],
      ].sort(),
    );
  });

  it("el dueño no sale; los demás sí, y el dueño puede echar", async () => {
    expect(await code(removeMember(groupId, "ana", "ana", deps()))).toBe("owner_leaves");
    expect(await code(removeMember(groupId, "beto", "carla", deps()))).toBe("forbidden");
    await removeMember(groupId, "carla", "carla", deps());
    expect(await code(memberGroup(groupId, "carla", deps()))).toBe("not_found");
  });
});

describe("partidas", () => {
  it("registra una partida de grupo con mazos y avisa a los demás", async () => {
    const gameId = await recordGame(
      "ana",
      {
        groupId,
        players: [
          { username: "ana", deckId: anaDeck, winner: false },
          { username: "@BETO", deckId: betoDeck, winner: true },
          { guestName: "Primo", deckName: "Krenko", winner: false },
        ],
      },
      deps(),
    );
    const g = await getGame(gameId, "beto", deps());
    expect(g.players.map((p) => [p.userId ?? p.guestName, p.deckName, p.winner])).toEqual([
      ["ana", "Teferi de Ana", false],
      ["beto", "Teferi oculto", true],
      ["Primo", "Krenko", false],
    ]);
    expect((await social.list("beto", 10)).find((n) => n.type === "game_recorded")?.title).toBe(
      "Ganó @beto",
    );
    // Dani no es del grupo ni jugó.
    expect(await code(getGame(gameId, "dani", deps()))).toBe("not_found");
  });

  it("valida jugadores, mazos y ganadores", async () => {
    const two = (over: object) =>
      recordGame(
        "ana",
        { groupId, players: [{ username: "ana", winner: false }, over as never] },
        deps(),
      );
    expect(await code(two({ username: "dani", winner: true }))).toBe("invalid_game");
    expect(await code(two({ username: "ana", winner: true }))).toBe("invalid_game");
    expect(await code(two({ guestName: " ", winner: true }))).toBe("invalid_game");
    expect(
      await code(
        recordGame(
          "ana",
          {
            players: [
              { username: "ana", winner: true },
              { username: "beto", winner: false },
            ],
          },
          deps(),
        ),
      ),
    ).toBe("invalid_game");
    // Mazo de otro jugador.
    expect(await code(two({ username: "beto", deckId: anaDeck, winner: true }))).toBe(
      "invalid_game",
    );
  });

  it("clasificación del grupo y borrar", async () => {
    const solo = await recordGame(
      "beto",
      {
        groupId,
        players: [
          { username: "beto", winner: false },
          { username: "ana", deckId: anaDeck, winner: true },
        ],
      },
      deps(),
    );
    const stats = await gameStats({ groupId }, deps());
    expect(stats.games).toBe(2);
    expect(stats.players.map((p) => [p.name, p.wins, p.games])).toEqual([
      ["@ana", 1, 2],
      ["@beto", 1, 2],
      ["Primo", 0, 1],
    ]);
    expect(stats.decks.find((d) => d.key === anaDeck)).toMatchObject({ wins: 1, games: 2 });
    expect((await gameStats({ deckId: betoDeck }, deps())).games).toBe(1);
    // La borra quien la registró o el dueño del grupo (Ana), no otro jugador.
    expect(await deleteGame(solo, "ana", deps())).toBeUndefined();
    expect((await gameStats({ groupId }, deps())).games).toBe(1);
  });
});

describe("préstamos", () => {
  it("solo copias libres; prestadas cuentan como ocupadas hasta devolverlas", async () => {
    expect(
      await code(lendCard("beto", { oracleId: id("Sol Ring"), quantity: 2, to: "@ana" }, deps())),
    ).toBe("not_free");
    const loan = await lendCard(
      "beto",
      { oracleId: id("Sol Ring"), quantity: 1, to: "@ana", note: "para el jueves" },
      deps(),
    );
    const usage = await new PrismaDeckRepository(db, "beto").usage();
    expect(usage.get(id("Sol Ring"))).toMatchObject({ quantity: 3 });
    expect(usage.get(id("Sol Ring"))?.decks).toContain("Prestada a @ana");
    expect((await myLoans("ana", false, deps())).borrowed.map((l) => l.id)).toEqual([loan]);
    expect((await social.list("ana", 10)).map((n) => n.type)).toContain("loan_new");

    await lendCard("beto", { oracleId: id("Mana Crypt"), quantity: 1, to: "Juan" }, deps());
    expect(await code(closeLoan(loan, "ana", "delete", deps()))).toBe("forbidden");
    await closeLoan(loan, "ana", "returned", deps());
    expect((await myLoans("beto", false, deps())).lent.map((l) => l.borrowerName)).toEqual([
      "Juan",
    ]);
    expect((await myLoans("beto", true, deps())).lent).toHaveLength(2);
    expect(await code(closeLoan(loan, "dani", "returned", deps()))).toBe("not_found");
  });
});

describe("comentarios y moderación", () => {
  it("comentar, borrar, denunciar y ocultar", async () => {
    const c1 = await addComment("beto", anaDeck, "  Mete un Sol Ring  ", deps());
    expect(await code(addComment("beto", anaDeck, "otro", deps()))).toBe("too_fast");
    expect(await code(addComment("carla", anaDeck, "   ", deps()))).toBe("comment_empty");
    const view = await deckComments(anaDeck, "ana", deps());
    expect(view.comments.map((c) => [c.body, c.canDelete, c.mine])).toEqual([
      ["Mete un Sol Ring", true, false],
    ]);
    expect((await social.list("ana", 10)).map((n) => n.type)).toContain("deck_comment");

    // Tres denuncias de gente distinta lo ocultan (salvo para el dueño del mazo).
    expect(await code(reportComment("beto", c1, "spam", deps()))).toBe("own_comment");
    for (const u of ["ana", "carla", "dani"]) await reportComment(u, c1, "spam", deps());
    expect((await deckComments(anaDeck, "carla", deps())).comments).toEqual([]);
    expect((await deckComments(anaDeck, "ana", deps())).comments[0]?.hidden).toBe(true);
    expect((await moderation.pending(10)).map((c) => [c.id, c.reasons.spam])).toEqual([[c1, 3]]);
    await moderateComment(c1, "keep", deps());
    expect((await deckComments(anaDeck, "carla", deps())).comments).toHaveLength(1);
    expect(await moderation.pending(10)).toEqual([]);

    expect(await code(deleteComment("carla", c1, deps()))).toBe("forbidden");
    await deleteComment("ana", c1, deps());
    expect((await deckComments(anaDeck, null, deps())).comments).toEqual([]);
  });

  it("mazos privados y comentarios cerrados", async () => {
    const priv = await saveDeck("carla", "Secreto", "private");
    expect(await code(addComment("dani", priv, "hola", deps()))).toBe("not_found");
    await moderation.setOpen(anaDeck, "ana", false);
    expect(await code(addComment("dani", anaDeck, "hola", deps()))).toBe("comments_closed");
    expect((await deckComments(anaDeck, "dani", deps())).canComment).toBe(false);
    await moderation.setOpen(anaDeck, "ana", true);
  });

  it("bloquear: no comenta, no sigue y desaparece del feed", async () => {
    await setFollowing("dani", "ana", true, { ...deps(), blocks: moderation });
    await setBlocked("ana", "dani", true, deps());
    expect(await social.isFollowing("dani", "ana")).toBe(false);
    expect(await code(addComment("dani", anaDeck, "hola", deps()))).toBe("blocked");
    expect(
      await setFollowing("dani", "ana", true, { ...deps(), blocks: moderation }).then(
        () => "ok",
        () => "refused",
      ),
    ).toBe("refused");
    expect((await activityFeed("dani", {}, deps())).following).toBe(0);
    await setBlocked("ana", "dani", false, deps());
    expect(await moderation.blocked("ana")).toEqual([]);
  });
});

describe("feed", () => {
  it("mezcla mazos, partidas y comentarios de quien sigo y de mi grupo", async () => {
    await setFollowing("dani", "ana", true, deps());
    await new Promise((r) => setTimeout(r, 15));
    await addComment("ana", anaDeck, "Gracias por las ideas", deps());
    const { items } = await activityFeed("dani", {}, deps());
    expect(items.map((i) => i.type)).toEqual(["comment", "game", "deck"]);
    const game = items.find((i) => i.type === "game");
    // Dani no es del grupo: no ve su nombre.
    expect(game?.type === "game" && game.game.group).toBeNull();

    const beto = await activityFeed("beto", { types: ["game"] }, deps());
    expect(beto.items.map((i) => i.type)).toEqual(["game"]);
    expect(beto.items[0]?.type === "game" && beto.items[0].game.group?.name).toBe("Los del jueves");
    // Paginado por fecha.
    const page = await activityFeed("dani", { limit: 1 }, deps());
    const next = await activityFeed("dani", { limit: 5, before: page.next! }, deps());
    expect(next.items.map((i) => i.type)).toEqual(["game", "deck"]);
  });
});
