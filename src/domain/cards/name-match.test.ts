import { describe, expect, it } from "vitest";
import { editDistance, NameIndex, scanKey } from "./name-match";

const index = new NameIndex([
  { oracleId: "ring", name: "Sol Ring", rank: 1 },
  { oracleId: "talisman", name: "Sol Talisman", rank: 900 },
  { oracleId: "bolt", name: "Lightning Bolt", rank: 5 },
  { oracleId: "helix", name: "Lightning Helix", rank: 50 },
  { oracleId: "ultros", name: "Ultros, Obnoxious Octopus", rank: 3000 },
  { oracleId: "ff", name: "Fire", rank: 100 },
  { oracleId: "ff", name: "Ice", rank: 100 },
  { oracleId: "jace", name: "Jace, Vryn's Prodigy", rank: 400 },
  { oracleId: "jace", name: "Jace, Telepath Unbound", rank: 400 },
]);

describe("NameIndex", () => {
  it("reconoce el nombre exacto y con letras mal leídas", () => {
    expect(index.match("Lightning Bolt")?.oracleId).toBe("bolt");
    expect(index.match("Lightnlng B0lt")).toMatchObject({ oracleId: "bolt" });
    expect(index.match("Lightning Helx")?.oracleId).toBe("helix");
  });

  it("tolera el coste de maná pegado detrás y los signos que se come el OCR", () => {
    expect(index.match("Sol Ring 1")?.oracleId).toBe("ring");
    expect(index.match("Ultros Obnoxious Octopus")?.oracleId).toBe("ultros");
    expect(index.match("Jace, Vryns Prodigy")?.oracleId).toBe("jace");
  });

  it("cada cara de una carta doble lleva a la misma carta", () => {
    expect(index.match("Telepath Unbound Jace")?.oracleId).toBe("jace");
    expect(index.match("Ice")?.oracleId).toBe("ff");
    expect(index.match("Ic")).toBeNull(); // menos de 3 letras: no se arriesga
  });

  it("no inventa: un texto que no se parece a nada da null", () => {
    expect(index.match("Creature — Elf Druid")).toBeNull();
    expect(index.match("zzzz qqqq")).toBeNull();
  });

  it("da un parecido entre 0 y 1", () => {
    const m = index.match("Sol Rinq");
    expect(m?.oracleId).toBe("ring");
    expect(m!.score).toBeGreaterThan(0.8);
    expect(m!.score).toBeLessThan(1);
  });
});

describe("utilidades", () => {
  it("scanKey quita signos y tildes", () => {
    expect(scanKey("Jace, Vryn’s Prodigy")).toBe("jace vryn s prodigy");
  });
  it("editDistance", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
});
