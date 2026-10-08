import { describe, expect, it } from "vitest";
import { fixtureIndex, readFixture } from "../../../tests/helpers/scryfall-fixtures";
import { parseManaboxCsv } from "./manabox";
import { matchCollection, ownedQuantities } from "./matching";

describe("matchCollection con el recorte del CSV real", () => {
  const index = fixtureIndex();
  const { rows } = parseManaboxCsv(
    readFixture("manabox_sample.csv") +
      "Carta Inventada,XXX,Nada,1,normal,common,1,0,,0,false,false,false,near_mint,en,false,EUR,x\n",
  );
  const { matched, unmatched } = matchCollection(rows, index);
  const method = (name: string) => matched.find((m) => m.row.name === name)?.method;

  it("empareja por Scryfall ID cuando existe", () => {
    expect(method("Thundertrap Trainer")).toBe("scryfallId");
    expect(method("Satsuki, the Living Lore")).toBe("scryfallId");
    expect(method("Grizzled Angler // Grisly Anglerfish")).toBe("scryfallId");
  });

  it("cae a set + número si el ID no está en el catálogo", () => {
    expect(method("Lantern Flare")).toBe("setNumber");
  });

  it("cae al nombre si tampoco hay impresión", () => {
    expect(method("Relm's Sketching")).toBe("name");
  });

  it("deja sin emparejar lo que no encuentra", () => {
    expect(unmatched.map((r) => r.name)).toEqual(["Carta Inventada"]);
    expect(matched).toHaveLength(16);
  });

  it("suma copias por oracleId", () => {
    const owned = ownedQuantities(matched);
    const lantern = matched.find((m) => m.row.name === "Lantern Flare");
    expect(owned.get(lantern?.oracleId ?? "")).toBe(2);
    expect([...owned.values()].reduce((a, b) => a + b, 0)).toBe(18);
  });
});

describe("matchCollection: varias impresiones de la misma carta", () => {
  it("cuentan como la misma carta", () => {
    const index = fixtureIndex();
    const { rows } = parseManaboxCsv(
      "Name,Set code,Collector number,Quantity,Scryfall ID\n" +
        "Sol Ring,C21,263,1,33333333-0000-4000-8000-000000000263\n" +
        "Sol Ring,LEA,270,1,33333333-0000-4000-8000-000000000270\n" +
        "Sol Ring,,,1,\n",
    );
    const { matched } = matchCollection(rows, index);
    expect(new Set(matched.map((m) => m.oracleId)).size).toBe(1);
    expect([...ownedQuantities(matched).values()]).toEqual([3]);
  });
});
