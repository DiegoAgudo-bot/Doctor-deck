import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { PrismaDeckRepository, PrismaPublicDecks } from "@/adapters/db/deck-repository";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { fixtureCards, fixturePrintings } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import {
  announceBigCards,
  announceNewDeck,
  CannotFollowSelfError,
  ensureUsername,
  profileView,
  ProfileNotFoundError,
  setFollowing,
  updateProfile,
  UsernameError,
} from "./social";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;
let cards: PrismaCardRepository;
const deps = () => ({
  profiles: social,
  follows: social,
  notifications: social,
  decksFor: (id: string) => new PrismaDeckRepository(db, id),
  cards,
});
const card = (name: string) => {
  const c = fixtureCards().find((x) => x.name === name && x.layout !== "token");
  if (!c) throw new Error(name);
  return c;
};
const deck = (name: string, isPublic?: boolean) => ({
  name,
  input: "",
  source: "text",
  theme: null,
  commanders: [{ oracleId: card("Teferi, Temporal Archmage").oracleId, name: "Teferi" }],
  cards: [],
  locked: [],
  excluded: [],
  ...(isPublic === undefined ? {} : { isPublic }),
});

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  await createTestUser(db, "ana");
  await createTestUser(db, "beto");
  await createTestUser(db, "carla");
  social = new PrismaSocialRepository(db);
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
  await cards.insertPrintings(fixturePrintings());
});
afterAll(async () => cleanup());

describe("nombres de usuario y perfil", () => {
  it("genera uno la primera vez y no lo cambia después", async () => {
    const first = await ensureUsername("ana", deps());
    expect(first.username).toBe("ana");
    expect((await ensureUsername("ana", deps())).username).toBe("ana");
  });

  it("valida, evita duplicados y reservados", async () => {
    await ensureUsername("beto", deps());
    await expect(updateProfile("beto", { username: "ana" }, deps())).rejects.toMatchObject({
      problem: "taken",
    });
    await expect(updateProfile("beto", { username: "Mal Nombre" }, deps())).rejects.toBeInstanceOf(
      UsernameError,
    );
    await expect(updateProfile("beto", { username: "admin" }, deps())).rejects.toMatchObject({
      problem: "reserved",
    });
    const updated = await updateProfile(
      "beto",
      { username: "Beto_Mtg", collectionPublic: true },
      deps(),
    );
    expect(updated).toMatchObject({ username: "beto_mtg", collectionPublic: true });
  });
});

describe("mazos públicos y perfiles", () => {
  it("los mazos nacen públicos; los privados solo los ve su dueño", async () => {
    const ana = new PrismaDeckRepository(db, "ana");
    const pub = await ana.save(deck("Público"));
    const priv = await ana.save(deck("Privado", false));
    const decks = new PrismaPublicDecks(db);
    expect((await decks.find(pub, null))?.deck.name).toBe("Público");
    expect(await decks.find(priv, null)).toBeNull();
    expect(await decks.find(priv, "beto")).toBeNull();
    expect((await decks.find(priv, "ana"))?.deck.name).toBe("Privado");
    expect((await decks.recent(10)).map((d) => d.name)).toEqual(["Público"]);

    expect((await profileView("ana", "beto", deps())).decks.map((d) => d.name)).toEqual([
      "Público",
    ]);
    expect((await profileView("ANA", "ana", deps())).decks).toHaveLength(2);
    await expect(profileView("nadie", null, deps())).rejects.toBeInstanceOf(ProfileNotFoundError);

    expect(await ana.setPublic(priv, true)).toBe(true);
    expect(await new PrismaDeckRepository(db, "beto").setPublic(priv, false)).toBe(false);
  });
});

describe("seguir y notificaciones", () => {
  it("sigue y deja de seguir; no a uno mismo", async () => {
    expect(await setFollowing("beto", "ana", true, deps())).toEqual({ followers: 1, following: 0 });
    await setFollowing("beto", "ana", true, deps()); // repetir no duplica
    await ensureUsername("carla", deps());
    await setFollowing("carla", "ana", true, deps());
    const view = await profileView("ana", "beto", deps());
    expect(view).toMatchObject({ followers: 2, isFollowing: true, isMe: false });
    await expect(setFollowing("ana", "ana", true, deps())).rejects.toBeInstanceOf(
      CannotFollowSelfError,
    );
    await setFollowing("carla", "ana", false, deps());
    expect((await profileView("ana", "carla", deps())).isFollowing).toBe(false);
  });

  it("avisa a los seguidores de un mazo nuevo público, no de uno privado", async () => {
    expect(
      await announceNewDeck("ana", { id: "x", name: "Privado", isPublic: false }, deps()),
    ).toBe(0);
    expect(await announceNewDeck("ana", { id: "d1", name: "Nuevo", isPublic: true }, deps())).toBe(
      1,
    );
    const [n] = await social.list("beto", 10);
    expect(n).toMatchObject({ type: "new_deck", deckId: "d1", title: "Nuevo", read: false });
    expect(n?.actor).toEqual({ username: "ana", name: "ana" });
    expect(await social.list("carla", 10)).toEqual([]);
  });

  it("avisa de cartas caras solo si la colección es pública", async () => {
    const config = { bigCardEur: 20, maxBigCardsPerAdd: 3 };
    const added = [
      { oracleId: card("Mana Crypt").oracleId, name: "Mana Crypt" },
      { oracleId: card("Sol Ring").oracleId, name: "Sol Ring" },
    ];
    // La colección de Ana es privada: nada.
    expect(await announceBigCards("ana", added, deps(), config)).toBe(0);
    await updateProfile("ana", { collectionPublic: true }, deps());
    // Solo Mana Crypt (150 €) pasa del umbral; Sol Ring (0,80 €) no.
    expect(await announceBigCards("ana", added, deps(), config)).toBe(1);
    const [n] = await social.list("beto", 1);
    expect(n).toMatchObject({ type: "big_card", title: "Mana Crypt", price: 150 });

    expect(await social.unreadCount("beto")).toBe(2);
    await social.markAllRead("beto");
    expect(await social.unreadCount("beto")).toBe(0);
  });
});
