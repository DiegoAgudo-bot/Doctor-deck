import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import { InMemoryCardIndex } from "./card-index";

const solRing = makeCard({ name: "Sol Ring" });
const delver = makeCard({ name: "Delver of Secrets // Insectile Aberration", layout: "transform" });
const fireIce = makeCard({ name: "Fire // Ice", layout: "split" });
const goblinToken = makeCard({ name: "Goblin Guide", layout: "token" });
const goblinGuide = makeCard({ name: "Goblin Guide" });
// Una "cara frontal" suelta (layout front_card) que se llama igual que la tierra de verdad.
const savageFront = makeCard({ name: "Savage Lands", layout: "front_card", legalCommander: false });
const savageLands = makeCard({ name: "Savage Lands", typeLine: "Land" });

const index = new InMemoryCardIndex(
  [solRing, delver, fireIce, goblinToken, goblinGuide, savageFront, savageLands],
  [
    {
      scryfallId: "AAAA-1",
      oracleId: solRing.oracleId,
      setCode: "C21",
      collectorNumber: "263",
      lang: "en",
      imageUrl: null,
    },
  ],
);

describe("InMemoryCardIndex", () => {
  it("busca por nombre sin importar formato", () => {
    expect(index.cardByName("sol ring")).toBe(solRing);
    expect(index.cardByName("Fire/Ice")).toBe(fireIce);
  });

  it("encuentra cartas de dos caras por su primera cara", () => {
    expect(index.cardByName("Delver of Secrets")).toBe(delver);
    expect(index.cardByName("Fire")).toBe(fireIce);
  });

  it("prefiere cartas jugables frente a tokens con el mismo nombre", () => {
    expect(index.cardByName("Goblin Guide")).toBe(goblinGuide);
  });

  it("prefiere la carta jugable a una cara frontal suelta con el mismo nombre", () => {
    expect(index.cardByName("Savage Lands")).toBe(savageLands);
  });

  it("busca impresiones por id (sin distinguir mayúsculas) y por set+número", () => {
    expect(index.printingById("aaaa-1")?.oracleId).toBe(solRing.oracleId);
    expect(index.printingBySetNumber("c21", "263")?.oracleId).toBe(solRing.oracleId);
    expect(index.printingBySetNumber("c21", "264")).toBeUndefined();
  });
});
