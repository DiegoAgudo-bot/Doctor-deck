import type { ProposalView } from "@/application/trade-proposals";
import type { Card } from "@/domain/cards/types";
import type { PublicProfile } from "@/domain/ports/social";
import type { TradeProposal } from "@/domain/ports/trade-proposals";
import type { ListedCard } from "@/domain/trades/lists";
import {
  copyKey,
  type TradeBalance,
  type TradeCopy,
  type TradeSides,
} from "@/domain/trades/proposal";
import { getContainer } from "./container";
import {
  cardDTO,
  cardWithPrintingDTO,
  publicProfileDTO,
  type TradeCardDTO,
  type TradeCopyDTO,
  type TradeProposalDTO,
  type TradeProposalSummaryDTO,
} from "./dto";

/** Dependencias de los casos de uso de intercambio, desde el contenedor. */
export function tradeDeps() {
  const c = getContainer();
  return {
    cards: c.cards,
    collectionFor: (id: string) => c.collectionFor(id),
    decksFor: (id: string) => c.decksFor(id),
    tradesFor: (id: string) => c.tradesFor(id),
    profiles: c.social,
    follows: c.social,
    notifications: c.social,
    proposals: c.tradeProposals,
    blocks: c.moderation,
  };
}

/** Pasa cartas de una lista a DTOs (con carta del catálogo y precio); las desconocidas se omiten. */
export async function tradeCards(
  items: readonly ListedCard[],
  prices: ReadonlyMap<string, number>,
): Promise<{ dto: TradeCardDTO[]; byId: Map<string, Card> }> {
  const found = await getContainer().cards.findCardsByOracleIds(items.map((i) => i.oracleId));
  const byId = new Map(found.map((c) => [c.oracleId, c]));
  const dto = items.flatMap((i) => {
    const card = byId.get(i.oracleId);
    return card
      ? [{ card: cardDTO(card), quantity: i.quantity, price: prices.get(i.oracleId) ?? null }]
      : [];
  });
  return { dto, byId };
}

/** Copias para cambiar a DTO, con su carta y su edición (las de cartas desconocidas se omiten). */
export async function tradeCopiesDTO(
  ...lists: (readonly TradeCopy[] | null)[]
): Promise<(TradeCopyDTO[] | null)[]> {
  const all = lists.flatMap((l) => l ?? []);
  const c = getContainer();
  const ids = [...new Set(all.flatMap((x) => (x.scryfallId ? [x.scryfallId] : [])))];
  const [found, printings] = await Promise.all([
    c.cards.findCardsByOracleIds([...new Set(all.map((x) => x.oracleId))]),
    ids.length > 0 ? c.cards.findPrintingsByIds(ids) : Promise.resolve([]),
  ]);
  const cards = new Map(found.map((x) => [x.oracleId, x]));
  const byPrinting = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p]));
  const toDTO = (x: TradeCopy): TradeCopyDTO[] => {
    const card = cards.get(x.oracleId);
    if (!card) return [];
    const p = x.scryfallId ? byPrinting.get(x.scryfallId.toLowerCase()) : undefined;
    return [
      {
        key: copyKey(x),
        card: cardWithPrintingDTO(card, p),
        scryfallId: x.scryfallId,
        foil: x.foil,
        language: x.language,
        quantity: x.quantity,
        unitPrice: x.unitPrice,
        printing: p
          ? { setCode: p.setCode, setName: p.setName ?? null, collectorNumber: p.collectorNumber }
          : null,
      },
    ];
  };
  return lists.map((l) =>
    l
      ? [...l]
          .map(toDTO)
          .flat()
          .sort((a, b) => a.card.name.localeCompare(b.card.name))
      : null,
  );
}

/** Una propuesta (o su resumen) vista por `viewerId`. */
export function proposalSummaryDTO(
  p: TradeProposal,
  partner: PublicProfile,
  sides: TradeSides,
  balance: TradeBalance,
  viewerId: string,
): TradeProposalSummaryDTO {
  return {
    id: p.id,
    status: p.status,
    version: p.version,
    partner: publicProfileDTO(partner),
    isMine: p.fromUserId === viewerId,
    myTurn: p.status === "pending" && p.turnUserId === viewerId,
    giveCount: sides.give.reduce((n, c) => n + c.quantity, 0),
    getCount: sides.get.reduce((n, c) => n + c.quantity, 0),
    balance,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function proposalDTO(v: ProposalView, viewerId: string): Promise<TradeProposalDTO> {
  const [give, get, myCopies, theirCopies] = await tradeCopiesDTO(
    v.sides.give,
    v.sides.get,
    v.myCopies,
    v.theirCopies,
  );
  return {
    ...proposalSummaryDTO(v.proposal, v.partner, v.sides, v.balance, viewerId),
    give: give ?? [],
    get: get ?? [],
    lastByMe: v.proposal.lastById === viewerId,
    actions: v.actions,
    myCopies: myCopies ?? null,
    theirCopies: theirCopies ?? null,
    unavailable: v.unavailable,
    createdAt: v.proposal.createdAt.toISOString(),
    closedAt: v.proposal.closedAt?.toISOString() ?? null,
  };
}
