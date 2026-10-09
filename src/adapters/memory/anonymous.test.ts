import { describe, expect, it } from "vitest";
import type { CollectionRow } from "@/domain/collection/manabox";
import { BrowserCollectionRepository, noSavedDecks } from "./anonymous";

const row = (name: string, quantity: number) => ({ name, quantity }) as unknown as CollectionRow;

describe("BrowserCollectionRepository", () => {
  it("usa la colección que manda el navegador", async () => {
    const repo = new BrowserCollectionRepository([
      ["a", 2],
      ["b", 1],
    ]);
    expect(await repo.ownedQuantities()).toEqual(
      new Map([
        ["a", 2],
        ["b", 1],
      ]),
    );
    expect(await repo.summary()).toMatchObject({ totalCards: 3, uniqueCards: 2 });
  });

  it("al importar suma las copias por carta sin guardar nada fuera", async () => {
    const repo = new BrowserCollectionRepository();
    await repo.replaceCollection({
      matched: [
        { oracleId: "a", scryfallId: "1", method: "scryfallId", row: row("A", 2) },
        { oracleId: "a", scryfallId: "2", method: "name", row: row("A", 1) },
      ],
      unmatched: [row("??", 1)],
    } as never);
    expect(await repo.ownedQuantities()).toEqual(new Map([["a", 3]]));
    expect(await repo.summary()).toMatchObject({ rows: 3, unmatchedRows: 1, uniqueCards: 1 });
  });
});

describe("noSavedDecks", () => {
  it("no tiene mazos ni copias en uso, y no guarda", async () => {
    expect(await noSavedDecks.list()).toEqual([]);
    expect(await noSavedDecks.usage()).toEqual(new Map());
    await expect(noSavedDecks.save({} as never)).rejects.toThrow(/iniciar sesión/);
  });
});
