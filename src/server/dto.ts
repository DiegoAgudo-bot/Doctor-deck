import type { AnalyzeDeckResult } from "@/application/analyze-deck";
import type { CollectionImportSummary } from "@/application/import-collection";
import type { Card, Color } from "@/domain/cards/types";
import type { SkippedLine } from "@/domain/deck/decklist";
import type { DeckIssue } from "@/domain/deck/resolve";
import type { CollectionSummary } from "@/domain/ports/collection-repository";
import type { ThemeLink } from "@/domain/recommendations/types";
import { ROLE_LABELS, type Role, type RoleClassifier } from "@/domain/roles/types";
import type { EngineConfig } from "@/domain/suggestions/config";
import type {
  AddCandidate,
  CardProblem,
  ScoredCard,
  SwapSuggestion,
} from "@/domain/suggestions/engine";

/*
 * Formas JSON de la API (/api/*). Las consumen la UI web y, en el futuro, la app móvil.
 * Los componentes de cliente solo importan los tipos (`import type`).
 */

export interface CardDTO {
  oracleId: string;
  name: string;
  imageUrl: string | null;
  typeLine: string;
  manaCost: string | null;
  cmc: number;
  colorIdentity: Color[];
}

export interface ScoredCardDTO {
  card: CardDTO;
  roles: Role[];
  primaryRole: Role;
  synergy: number | null;
  inclusion: number | null;
  inEdhrec: boolean;
  problem: CardProblem | null;
  owned?: number;
}

export interface SwapDTO {
  id: string;
  out: ScoredCardDTO;
  in: ScoredCardDTO;
  score: number;
  sameRole: boolean;
  fillsDeficit: Role[];
  reason: string;
}

export interface DeckCardDTO {
  card: CardDTO;
  quantity: number;
  roles: Role[];
  primaryRole: Role;
  isBasicLand: boolean;
}

export interface IssueDTO {
  kind: DeckIssue["kind"];
  message: string;
}

export interface RoleStatDTO {
  role: Role;
  label: string;
  count: number;
  min: number;
}

export type AnalyzeResponse =
  | {
      status: "needs_commander";
      candidates: CardDTO[];
      skipped: SkippedLine[];
      unresolved: string[];
    }
  | {
      status: "ok";
      commanders: CardDTO[];
      cards: DeckCardDTO[];
      totalCards: number;
      issues: IssueDTO[];
      skipped: SkippedLine[];
      unresolved: string[];
      curve: Record<number, number>;
      roles: RoleStatDTO[];
      edhrec: {
        commanderSlug: string;
        theme: string | null;
        totalDecks: number | null;
        themes: ThemeLink[];
        fetchedAt: string;
        stale: boolean;
        warning: string | null;
        unresolved: string[];
      };
      swaps: SwapDTO[];
      addCandidates: ScoredCardDTO[];
      cutCandidates: ScoredCardDTO[];
    };

export interface StatusResponse {
  catalog: { cards: number; printings: number };
  collection: Omit<CollectionSummary, "importedAt"> & { importedAt: string | null };
}

export type CollectionImportResponse = Omit<CollectionImportSummary, "unmatched" | "errors"> & {
  unmatched: {
    line: number;
    name: string;
    setCode: string | null;
    collectorNumber: string | null;
  }[];
  errors: { line: number; reason: string }[];
};

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ---------- mapeadores ----------

export const cardDTO = (c: Card): CardDTO => ({
  oracleId: c.oracleId,
  name: c.name,
  imageUrl: c.imageUrl,
  typeLine: c.typeLine,
  manaCost: c.manaCost,
  cmc: c.cmc,
  colorIdentity: c.colorIdentity,
});

const scoredDTO = (s: ScoredCard | AddCandidate): ScoredCardDTO => ({
  card: cardDTO(s.card),
  roles: s.roles.roles,
  primaryRole: s.roles.primary,
  synergy: s.synergy,
  inclusion: s.inclusion,
  inEdhrec: s.inEdhrec,
  problem: s.problem,
  ...("owned" in s ? { owned: s.owned } : {}),
});

const swapDTO = (s: SwapSuggestion): SwapDTO => ({
  id: `${s.out.card.oracleId}>${s.in.card.oracleId}`,
  out: scoredDTO(s.out),
  in: scoredDTO(s.in),
  score: s.score,
  sameRole: s.sameRole,
  fillsDeficit: s.fillsDeficit,
  reason: s.reason,
});

export function issueMessage(i: DeckIssue): string {
  switch (i.kind) {
    case "size":
      return `El mazo tiene ${i.count} cartas (deberían ser 100).`;
    case "noCommander":
      return "No hay comandante.";
    case "duplicate":
      return `${i.card.name} aparece ${i.quantity} veces (Commander es singleton).`;
    case "colorIdentity":
      return `${i.card.name} está fuera de la identidad de color del comandante.`;
    case "notLegal":
      return `${i.card.name} no es legal en Commander.`;
  }
}

export function analyzeResponse(
  result: AnalyzeDeckResult,
  classifier: RoleClassifier,
  config: EngineConfig,
): AnalyzeResponse {
  const unresolved = result.deck.unresolved.map((e) => e.name);
  if (result.status === "needs_commander") {
    return {
      status: "needs_commander",
      candidates: result.candidates.map(cardDTO),
      skipped: result.skipped,
      unresolved,
    };
  }
  const { deck, suggestions: s } = result;
  return {
    status: "ok",
    commanders: deck.commanders.map(cardDTO),
    cards: deck.cards.map(({ card, quantity }) => {
      const roles = classifier.classify(card);
      return {
        card: cardDTO(card),
        quantity,
        roles: roles.roles,
        primaryRole: roles.primary,
        isBasicLand: card.isBasicLand,
      };
    }),
    totalCards: deck.commanders.length + deck.cards.reduce((n, c) => n + c.quantity, 0),
    issues: result.issues.map((i) => ({ kind: i.kind, message: issueMessage(i) })),
    skipped: result.skipped,
    unresolved,
    curve: result.curve,
    roles: (Object.keys(s.roleCounts) as Role[]).map((role) => ({
      role,
      label: ROLE_LABELS[role],
      count: s.roleCounts[role],
      min: config.minimums[role] ?? 0,
    })),
    edhrec: { ...result.edhrec, fetchedAt: result.edhrec.fetchedAt.toISOString() },
    swaps: s.swaps.map(swapDTO),
    addCandidates: s.addCandidates.slice(0, 40).map(scoredDTO),
    cutCandidates: s.cutCandidates.slice(0, 40).map(scoredDTO),
  };
}

export function collectionImportResponse(s: CollectionImportSummary): CollectionImportResponse {
  return {
    ...s,
    unmatched: s.unmatched.map((r) => ({
      line: r.line,
      name: r.name,
      setCode: r.setCode,
      collectorNumber: r.collectorNumber,
    })),
    errors: s.errors.map((e) => ({ line: e.line, reason: e.reason })),
  };
}
