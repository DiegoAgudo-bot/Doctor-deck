import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import type { Db } from "@/adapters/db/prisma";
import { TaggerError } from "@/adapters/scryfall/tagger-errors";
import type { TaggerSource } from "@/domain/ports/tagger-source";
import { fixtureCards } from "../../tests/helpers/scryfall-fixtures";
import { createTestDb } from "../../tests/helpers/test-db";
import { syncOracleTags } from "./sync-otags";

let db: Db;
let cleanup: () => Promise<void>;
let cards: PrismaCardRepository;

const sol = () => fixtureCards().find((c) => c.name === "Sol Ring" && c.layout === "normal")!;
const dig = () => fixtureCards().find((c) => c.name === "Dig Through Time")!;

beforeAll(async () => {
  ({ db, cleanup } = createTestDb());
  cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards());
});
afterAll(async () => cleanup());

const source = (tags: Record<string, string[] | Error>): TaggerSource & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    async cardsWithTag(tag) {
      calls.push(tag);
      const r = tags[tag] ?? [];
      if (r instanceof Error) throw r;
      return r;
    },
  };
};

describe("syncOracleTags", () => {
  it("guarda las etiquetas y las cartas salen con ellas, también tras vaciar el catálogo", async () => {
    const s = source({ ramp: [sol().oracleId], draw: [dig().oracleId, sol().oracleId] });
    const now = () => new Date("2026-10-11T10:00:00Z");
    const r = await syncOracleTags(["ramp", "draw"], { source: s, writer: cards, now });
    expect(r.map((x) => [x.tag, x.status, x.cards])).toEqual([
      ["ramp", "synced", 1],
      ["draw", "synced", 2],
    ]);
    const [found] = await cards.findCardsByOracleIds([sol().oracleId]);
    expect(found?.otags).toEqual(["draw", "ramp"]);

    await cards.clearCatalog();
    await cards.insertCards(fixtureCards());
    expect(
      (await cards.findCardsByNameKeys(["sol ring"])).find((c) => c.layout === "normal")?.otags,
    ).toEqual(["draw", "ramp"]);
  });

  it("no vuelve a descargar lo reciente salvo con force", async () => {
    const s = source({ ramp: [] });
    const now = () => new Date("2026-10-12T10:00:00Z");
    const r = await syncOracleTags(["ramp"], { source: s, writer: cards, now });
    expect(r[0]).toMatchObject({ status: "fresh", cards: 1 });
    expect(s.calls).toEqual([]);
    await syncOracleTags(["ramp"], { source: s, writer: cards, now }, { force: true });
    expect((await cards.findCardsByOracleIds([sol().oracleId]))[0]?.otags).toEqual(["draw"]);
  });

  it("si falla conserva lo anterior y, si está bloqueado, no sigue con las demás", async () => {
    const s = source({
      draw: new TaggerError("blocked", "HTTP 429"),
      removal: [dig().oracleId],
    });
    const r = await syncOracleTags(
      ["draw", "removal"],
      { source: s, writer: cards },
      { force: true },
    );
    expect(r).toEqual([{ tag: "draw", status: "failed", cards: 2, error: "HTTP 429" }]);
    expect(s.calls).toEqual(["draw"]);
    expect((await cards.findCardsByOracleIds([dig().oracleId]))[0]?.otags).toEqual(["draw"]);
  });
});
