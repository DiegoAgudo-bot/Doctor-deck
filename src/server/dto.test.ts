import { estimateBracket } from "@/domain/deck/bracket";
import { deckOwnership } from "@/domain/deck/ownership";
import { describe, expect, it } from "vitest";
import { makeCard } from "../../tests/helpers/cards";
import type { AnalyzeDeckResult } from "@/application/analyze-deck";
import { HeuristicRoleClassifier } from "@/domain/roles/heuristic-classifier";
import { DEFAULT_ENGINE_CONFIG } from "@/domain/suggestions/config";
import { suggestSwaps } from "@/domain/suggestions/engine";
import { analyzeResponse } from "./dto";

describe("analyzeResponse", () => {
  it("convierte el resultado en JSON serializable con mensajes en español", () => {
    const commander = makeCard({
      name: "Teferi, Temporal Archmage",
      typeLine: "Legendary Planeswalker — Teferi",
      colorIdentity: ["U"],
    });
    const bolt = makeCard({
      name: "Lightning Bolt",
      typeLine: "Instant",
      colorIdentity: ["R"],
      oracleText: "Lightning Bolt deals 3 damage to any target.",
    });
    const deck = {
      commanders: [commander],
      commanderSource: "marked" as const,
      commanderCandidates: [],
      cards: [{ card: bolt, quantity: 1, lines: [2] }],
      unresolved: [
        {
          line: 3,
          quantity: 1,
          name: "Nada",
          setCode: null,
          collectorNumber: null,
          foil: false,
          commander: false,
        },
      ],
    };
    const classifier = new HeuristicRoleClassifier();
    const result: AnalyzeDeckResult = {
      status: "ok",
      source: "text",
      deckName: null,
      deck,
      issues: [{ kind: "colorIdentity", card: bolt, identity: ["U"] }],
      skipped: [],
      curve: { 0: 0, 1: 1 },
      edhrec: {
        commanderSlug: "teferi-temporal-archmage",
        theme: null,
        totalDecks: 10,
        themes: [],
        fetchedAt: new Date("2026-10-08T00:00:00Z"),
        stale: false,
        warning: null,
        unresolved: [],
      },
      purchases: null,
      bracket: estimateBracket([]),
      ownership: {
        ...deckOwnership(deck.commanders, deck.cards, new Map()),
        prices: new Map([[bolt.oracleId, 0.5]]),
        cost: 0.5,
      },
      suggestions: suggestSwaps({
        deck,
        recommendations: [],
        owned: new Map(),
        locked: new Set(),
        classifier,
        config: DEFAULT_ENGINE_CONFIG,
      }),
    };
    const dto = analyzeResponse(result, classifier, DEFAULT_ENGINE_CONFIG);
    if (dto.status !== "ok") throw new Error();
    expect(dto.totalCards).toBe(2);
    expect(dto.unresolved).toEqual(["Nada"]);
    expect(dto.issues[0]?.message).toBe(
      "Lightning Bolt está fuera de la identidad de color del comandante.",
    );
    expect(dto.cards[0]).toMatchObject({ primaryRole: "removal", isBasicLand: false });
    expect(dto.ownership.totals).toEqual({
      cards: 2,
      have: 0,
      fromOtherDecks: 0,
      toBuy: 2,
      cost: 0.5,
    });
    expect(dto.ownership.items.find((i) => i.card.name === "Lightning Bolt")).toMatchObject({
      status: "missing",
      price: 0.5,
    });
    expect(dto.roles.find((r) => r.role === "land")).toMatchObject({
      label: "tierra",
      count: 0,
      min: 36,
    });
    expect(dto.cutCandidates[0]?.problem).toBe("offColor");
    expect(dto.edhrec.fetchedAt).toBe("2026-10-08T00:00:00.000Z");
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});
