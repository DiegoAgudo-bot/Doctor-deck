import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/adapters/db/prisma";
import { PrismaSocialRepository } from "@/adapters/db/social-repository";
import { createTestDb, createTestUser } from "../../tests/helpers/test-db";
import { sendWeeklyDigests } from "./digest";

let db: Db;
let cleanup: () => Promise<void>;
let social: PrismaSocialRepository;
const sent: { to: string; subject: string; text: string }[] = [];
const deps = (fail = false) => ({
  profiles: social,
  notifications: social,
  mailer: {
    send: async (m: { to: string; subject: string; text: string }) => {
      if (fail) throw new Error("sin correo");
      sent.push(m);
    },
  },
  siteUrl: "https://dd.test",
});
// Los avisos se crean con la hora real: «ahora» también, para que la semana sea la suya.
const now = new Date();

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  social = new PrismaSocialRepository(db);
  for (const id of ["ana", "beto", "carla"]) await createTestUser(db, id);
  await db.user.updateMany({ data: { emailVerified: true } });
  // Ana y Carla lo tienen activado; Beto no. Solo Ana y Beto tienen avisos esta semana.
  await social.setWeeklyDigest("ana", true);
  await social.setWeeklyDigest("carla", true);
  await social.create(
    ["ana", "beto"].map((userId) => ({
      userId,
      actorId: userId,
      type: "price_drop" as const,
      cardId: "sol",
      title: "Sol Ring",
      price: 1,
      prevPrice: 2,
    })),
  );
});
afterAll(async () => cleanup());

describe("sendWeeklyDigests", () => {
  it("si el correo falla no se da por enviado", async () => {
    expect(await sendWeeklyDigests(deps(true), now)).toBe(0);
    expect(sent).toEqual([]);
  });

  it("solo a quien lo activó y tiene avisos, y una vez por semana", async () => {
    expect(await sendWeeklyDigests(deps(), now)).toBe(1);
    expect(sent).toHaveLength(1);
    const email = (await db.user.findUniqueOrThrow({ where: { id: "ana" } })).email;
    expect(sent[0]).toMatchObject({ to: email });
    expect(sent[0]?.text).toContain("Sol Ring");
    expect(sent[0]?.text).toContain("https://dd.test/settings");
    // Al día siguiente no se repite; a la semana, si no hay avisos nuevos, tampoco.
    expect(await sendWeeklyDigests(deps(), new Date(now.getTime() + 86_400_000))).toBe(0);
    expect(await sendWeeklyDigests(deps(), new Date(now.getTime() + 8 * 86_400_000))).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("sin el email verificado no se manda", async () => {
    await db.user.update({ where: { id: "carla" }, data: { emailVerified: false } });
    await social.create([
      { userId: "carla", actorId: "carla", type: "price_rise", cardId: "x", title: "Mana Crypt" },
    ]);
    expect(await sendWeeklyDigests(deps(), now)).toBe(0);
  });
});
