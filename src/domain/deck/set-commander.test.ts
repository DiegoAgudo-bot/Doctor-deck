import { describe, expect, it } from "vitest";
import { parseDecklist } from "./decklist";
import { decklistWithCommanders } from "./set-commander";

const commanders = (text: string) =>
  parseDecklist(text)
    .entries.filter((e) => e.commander)
    .map((e) => e.name);
const main = (text: string) =>
  parseDecklist(text)
    .entries.filter((e) => !e.commander)
    .map((e) => `${e.quantity} ${e.name}`);

describe("decklistWithCommanders", () => {
  it("añade un comandante que no está en la lista", () => {
    const out = decklistWithCommanders("1 Sol Ring\n1 Arcane Signet\n", [
      "Hearthhull, the Worldseed",
    ]);
    expect(commanders(out)).toEqual(["Hearthhull, the Worldseed"]);
    expect(main(out)).toEqual(["1 Sol Ring", "1 Arcane Signet"]);
  });

  it("sube la carta del mazo a comandante con su edición, sin duplicarla", () => {
    const out = decklistWithCommanders("1x Sol Ring\n1 Atraxa, Praetors' Voice (ONE) 1 *F*\n", [
      "atraxa, praetors’ voice",
    ]);
    const parsed = parseDecklist(out).entries;
    expect(parsed.filter((e) => e.commander)).toMatchObject([
      { name: "Atraxa, Praetors' Voice", setCode: "one", collectorNumber: "1", foil: true },
    ]);
    expect(main(out)).toEqual(["1 Sol Ring"]);
  });

  it("el comandante que marcaba la lista pasa al mazo", () => {
    const text = "Commander\n1 Teferi, Temporal Archmage\n\nDeck\n1 Sol Ring\n1 Kenrith *CMDR*\n";
    const out = decklistWithCommanders(text, ["Atraxa, Praetors' Voice"]);
    expect(commanders(out)).toEqual(["Atraxa, Praetors' Voice"]);
    expect(main(out)).toEqual(["1 Teferi, Temporal Archmage", "1 Sol Ring", "1 Kenrith"]);
  });

  it("quita la categoría Commander de Archidekt y conserva las demás", () => {
    const out = decklistWithCommanders("1 Kenrith [Commander{top},Ramp]\n1 Sol Ring [Ramp]\n", [
      "Atraxa, Praetors' Voice",
    ]);
    expect(commanders(out)).toEqual(["Atraxa, Praetors' Voice"]);
    expect(parseDecklist(out).entries.find((e) => e.name === "Kenrith")?.tags).toEqual(["Ramp"]);
  });

  it("dos comandantes (pareja)", () => {
    const out = decklistWithCommanders("1 Sol Ring\n1 Tymna the Weaver\n", [
      "Thrasios, Triton Hero",
      "Tymna the Weaver",
    ]);
    expect(commanders(out)).toEqual(["Thrasios, Triton Hero", "Tymna the Weaver"]);
    expect(main(out)).toEqual(["1 Sol Ring"]);
  });
});
