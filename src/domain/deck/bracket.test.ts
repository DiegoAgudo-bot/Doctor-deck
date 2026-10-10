import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import type { Card } from "../cards/types";
import type { Role } from "../roles/types";
import { estimateBracket, isExtraTurn, isMassLandDenial } from "./bracket";

const entry = (card: Card, roles: Role[] = ["synergy"]) => ({ card, roles });
const gc = (name: string) => entry(makeCard({ name, gameChanger: true }));
const plain = (n: number) =>
  Array.from({ length: n }, (_, i) => entry(makeCard({ name: `Carta ${i}` })));

describe("detectores de texto", () => {
  it("destrucción masiva de tierras", () => {
    const mld = (oracleText: string, name = "X") =>
      isMassLandDenial(makeCard({ name, oracleText }));
    expect(mld("Destroy all lands.", "Armageddon")).toBe(true);
    expect(mld("Destroy all nonbasic lands.")).toBe(true);
    expect(mld("Destroy all artifacts, creatures, and lands.")).toBe(true);
    expect(mld("Each player sacrifices three lands of their choice.")).toBe(true);
    expect(mld("Nonbasic lands are Mountains.", "Blood Moon")).toBe(true);
    expect(mld("Players can't untap more than one land during their untap steps.")).toBe(true);
    // Sacrificar tus propias tierras como coste no es destrucción masiva.
    expect(mld("As an additional cost to cast this spell, sacrifice five lands.")).toBe(false);
    expect(mld("Kicker—Sacrifice two lands.")).toBe(false);
    expect(
      mld("Up to three target lands don't untap during their controller's next untap step."),
    ).toBe(false);
    expect(mld("Destroy target land.")).toBe(false);
  });

  it("turnos extra", () => {
    expect(
      isExtraTurn(
        makeCard({
          name: "Time Warp",
          oracleText: "Target player takes an extra turn after this one.",
        }),
      ),
    ).toBe(true);
    expect(
      isExtraTurn(makeCard({ name: "Y", oracleText: "Take an extra turn after this one." })),
    ).toBe(true);
    expect(isExtraTurn(makeCard({ name: "Z", oracleText: "Draw a card." }))).toBe(false);
  });
});

describe("estimateBracket", () => {
  it("sin nada que lo suba: bracket 2", () => {
    const e = estimateBracket(plain(99));
    expect(e.bracket).toBe(2);
    expect(e.combosChecked).toBe(false);
  });

  it("de 1 a 3 game changers: bracket 3; 4 o más: bracket 4", () => {
    const three = estimateBracket([
      ...plain(96),
      gc("Rhystic Study"),
      gc("Smothering Tithe"),
      gc("Cyclonic Rift"),
    ]);
    expect(three.bracket).toBe(3);
    expect(three.gameChangers).toEqual(["Cyclonic Rift", "Rhystic Study", "Smothering Tithe"]);
    expect(three.reasons[0]).toContain("3 game changers");
    const four = estimateBracket([...plain(95), gc("A"), gc("B"), gc("C"), gc("D")]);
    expect(four.bracket).toBe(4);
  });

  it("la destrucción masiva de tierras lo sube a 4", () => {
    const e = estimateBracket([
      ...plain(98),
      entry(makeCard({ name: "Armageddon", oracleText: "Destroy all lands." })),
    ]);
    expect(e).toMatchObject({ bracket: 4, massLandDenial: ["Armageddon"] });
  });

  it("pocas cartas de turno extra no lo suben; tres o más sí", () => {
    const turn = (name: string) =>
      entry(makeCard({ name, oracleText: "Take an extra turn after this one." }));
    expect(estimateBracket([...plain(97), turn("T1"), turn("T2")]).bracket).toBe(2);
    expect(estimateBracket([...plain(96), turn("T1"), turn("T2"), turn("T3")]).bracket).toBe(4);
  });

  it("cuenta los tutores sin que suban el bracket", () => {
    const e = estimateBracket([
      ...plain(98),
      entry(makeCard({ name: "Diabolic Tutor" }), ["tutor"]),
    ]);
    expect(e).toMatchObject({ bracket: 2, tutors: ["Diabolic Tutor"] });
  });
});
