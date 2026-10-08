import type { Card } from "@/domain/cards/types";

let seq = 0;

/** Crea una carta de prueba con valores por defecto razonables. */
export function makeCard(overrides: Partial<Card> & Pick<Card, "name">): Card {
  seq += 1;
  return {
    oracleId: `oracle-${seq}`,
    frontFaceName: null,
    layout: "normal",
    manaCost: null,
    cmc: 0,
    typeLine: "Artifact",
    oracleText: null,
    keywords: [],
    colorIdentity: [],
    legalCommander: true,
    isBasicLand: false,
    edhrecRank: null,
    imageUrl: null,
    ...overrides,
  };
}
