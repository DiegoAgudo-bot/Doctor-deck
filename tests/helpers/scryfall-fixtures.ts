import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryCardIndex } from "@/domain/cards/card-index";
import type { Card, Printing } from "@/domain/cards/types";
import { scryfallCardSchema, toCard, toPrinting } from "@/adapters/scryfall/mapping";

export const FIXTURES = path.resolve(__dirname, "../fixtures");

const load = (file: string) =>
  (JSON.parse(readFileSync(path.join(FIXTURES, "scryfall", file), "utf8")) as unknown[]).map(
    (raw) => scryfallCardSchema.parse(raw),
  );

export function fixtureCards(): Card[] {
  return load("oracle_cards.sample.json").flatMap((c) => toCard(c) ?? []);
}

export function fixturePrintings(): Printing[] {
  return load("default_cards.sample.json").flatMap((c) => toPrinting(c) ?? []);
}

export function fixtureIndex(): InMemoryCardIndex {
  return new InMemoryCardIndex(fixtureCards(), fixturePrintings());
}

export const readFixture = (rel: string) => readFileSync(path.join(FIXTURES, rel), "utf8");
