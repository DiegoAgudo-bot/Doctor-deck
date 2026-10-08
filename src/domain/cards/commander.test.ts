import { describe, expect, it } from "vitest";
import { makeCard } from "../../../tests/helpers/cards";
import {
  canBeCommander,
  combinedColorIdentity,
  fitsColorIdentity,
  isValidCommanderPair,
} from "./commander";

const atraxa = makeCard({
  name: "Atraxa, Praetors' Voice",
  typeLine: "Legendary Creature — Phyrexian Angel Horror",
  colorIdentity: ["W", "U", "B", "G"],
});
const solRing = makeCard({ name: "Sol Ring", typeLine: "Artifact" });
const teferi = makeCard({
  name: "Teferi, Temporal Archmage",
  typeLine: "Legendary Planeswalker — Teferi",
  oracleText: "−10: ...\nTeferi, Temporal Archmage can be your commander.",
  colorIdentity: ["U"],
});
const thrasios = makeCard({
  name: "Thrasios, Triton Hero",
  typeLine: "Legendary Creature — Merfolk Wizard",
  keywords: ["Partner"],
  oracleText: "{4}: Scry 1...\nPartner (You can have two commanders if both have partner.)",
  colorIdentity: ["G", "U"],
});
const tymna = makeCard({
  name: "Tymna the Weaver",
  typeLine: "Legendary Creature — Human Cleric",
  keywords: ["Partner", "Lifelink"],
  colorIdentity: ["W", "B"],
});
const pir = makeCard({
  name: "Pir, Imaginative Rascal",
  typeLine: "Legendary Creature — Human",
  keywords: ["Partner with"],
  oracleText: "Partner with Toothy, Imaginary Friend (When this creature enters...)",
});
const toothy = makeCard({
  name: "Toothy, Imaginary Friend",
  typeLine: "Legendary Creature — Illusion",
  keywords: ["Partner with"],
  oracleText: "Partner with Pir, Imaginative Rascal (When this creature enters...)",
});
const wilson = makeCard({
  name: "Wilson, Refined Grizzly",
  typeLine: "Legendary Creature — Bear Warrior",
  oracleText: "Choose a Background (You can have a Background as a second commander.)",
  colorIdentity: ["G"],
});
const background = makeCard({
  name: "Raised by Giants",
  typeLine: "Legendary Enchantment — Background",
  colorIdentity: ["G"],
});
const delver = makeCard({
  name: "Delver of Secrets // Insectile Aberration",
  typeLine: "Creature — Human Wizard // Creature — Human Insect",
});

describe("canBeCommander", () => {
  it("acepta criaturas legendarias y cartas con 'can be your commander'", () => {
    expect(canBeCommander(atraxa)).toBe(true);
    expect(canBeCommander(teferi)).toBe(true);
    expect(canBeCommander(background)).toBe(true);
  });
  it("rechaza el resto", () => {
    expect(canBeCommander(solRing)).toBe(false);
    expect(canBeCommander(delver)).toBe(false);
  });
});

describe("isValidCommanderPair", () => {
  it("un único comandante normal es válido; un background solo no", () => {
    expect(isValidCommanderPair(atraxa)).toBe(true);
    expect(isValidCommanderPair(background)).toBe(false);
  });
  it("partner + partner", () => {
    expect(isValidCommanderPair(thrasios, tymna)).toBe(true);
    expect(isValidCommanderPair(thrasios, atraxa)).toBe(false);
  });
  it("partner with exige la pareja exacta", () => {
    expect(isValidCommanderPair(pir, toothy)).toBe(true);
    expect(isValidCommanderPair(pir, thrasios)).toBe(false);
  });
  it("choose a background + background", () => {
    expect(isValidCommanderPair(wilson, background)).toBe(true);
    expect(isValidCommanderPair(background, wilson)).toBe(true);
    expect(isValidCommanderPair(atraxa, background)).toBe(false);
  });
});

describe("identidad de color", () => {
  it("combina la de los comandantes en orden WUBRG", () => {
    expect(combinedColorIdentity([thrasios, tymna])).toEqual(["W", "U", "B", "G"]);
  });
  it("comprueba si una carta cabe", () => {
    expect(fitsColorIdentity(solRing, ["U"])).toBe(true);
    expect(fitsColorIdentity(atraxa, ["W", "U", "B"])).toBe(false);
  });
});
