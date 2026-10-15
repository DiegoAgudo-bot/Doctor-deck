import { describe, expect, it } from "vitest";
import { readCardText, setCodeVariants } from "./scan-text";

describe("readCardText", () => {
  it("carta moderna (2023+): número con ceros y rareza, edición e idioma", () => {
    const r = readCardText([
      "Sol Ring 1",
      "Artifact",
      "{T}: Add {C}{C}.",
      "0263 U",
      "C21 • ES",
      "Illus. Mike Bierek",
    ]);
    expect(r).toEqual({
      nameLines: ["Sol Ring 1", "Artifact"],
      setCode: "c21",
      collectorNumber: "263",
      language: "es",
    });
  });

  it("formato 2015–2022: número/total y rareza; no confunde la fuerza/resistencia", () => {
    const r = readCardText([
      "Llanowar Elves",
      "Creature — Elf Druid",
      "{T}: Add {G}.",
      "1/1",
      "314/280 C",
      "M19 * EN",
    ]);
    expect(r.collectorNumber).toBe("314");
    expect(r.setCode).toBe("m19");
    expect(r.language).toBe("en");
  });

  it("corrige letras leídas como números y acepta separadores raros", () => {
    const r = readCardText(["Counterspell", "R O12O", "MH2-JP"]);
    expect(r.collectorNumber).toBe("120");
    expect(r.setCode).toBe("mh2");
    expect(r.language).toBe("ja");
  });

  it("sin línea de coleccionista (cartas antiguas) solo da el nombre", () => {
    const r = readCardText(["Lightning Bolt", "Instant", "Lightning Bolt deals 3 damage", "3/3"]);
    expect(r).toMatchObject({ setCode: null, collectorNumber: null, language: null });
    expect(r.nameLines[0]).toBe("Lightning Bolt");
  });

  it("no toma el copyright, el ilustrador ni números sueltos como nombre", () => {
    const r = readCardText(["Illus. Rebecca Guay", "™ & © 2024 Wizards of the Coast", "12", "Opt"]);
    expect(r.nameLines).toEqual(["Opt"]);
    expect(r.collectorNumber).toBeNull();
  });
});

describe("setCodeVariants", () => {
  it("prueba 0↔O y 1↔I sin pasarse", () => {
    expect(setCodeVariants("m2o")).toEqual(["m2o", "m20"]);
    expect(setCodeVariants("c21")).toContain("c2i");
    expect(setCodeVariants("abcdefgh").length).toBeLessThanOrEqual(8);
  });
});
