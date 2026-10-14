import { printingPrice } from "@/domain/cards/types";
import type {
  NotificationRepository,
  NotificationType,
  ProfileRepository,
  PublicProfile,
} from "@/domain/ports/social";
import {
  MissingCopiesError,
  ProposalNotPendingError,
  type ProposalItem,
  type TradeProposal,
  type TradeProposalRepository,
} from "@/domain/ports/trade-proposals";
import type { ListedCard } from "@/domain/trades/lists";
import {
  balanceTrade,
  buildTradeCopies,
  priceItems,
  proposeTrade,
  tradeBalance,
  type CopyKey,
  type TradeBalance,
  type TradeCopy,
  type TradeSides,
} from "@/domain/trades/proposal";
import type { BlockRepository } from "@/domain/ports/moderation";
import { userLists, type TradeDeps } from "./trades";

export type TradeProposalProblem =
  | "not_found"
  | "private"
  | "self"
  | "forbidden"
  | "not_your_turn"
  | "closed"
  | "empty"
  | "unavailable"
  | "missing_copies"
  | "blocked";

const MESSAGES: Record<TradeProposalProblem, string> = {
  not_found: "Esa propuesta de intercambio no existe.",
  private: "Ese usuario no tiene sus listas de intercambio públicas.",
  self: "No puedes proponerte un intercambio a ti mismo.",
  forbidden: "No puedes hacer eso con esta propuesta.",
  not_your_turn: "Le toca responder a la otra persona.",
  closed: "Esta propuesta ya está cerrada.",
  empty: "La propuesta no tiene ninguna carta.",
  unavailable: "Algunas cartas ya no están disponibles para cambiar.",
  blocked: "No puedes proponer intercambios a esta persona.",
  missing_copies:
    "No se puede aceptar: ya no están todas las cartas en la colección de quien las da.",
};

export class TradeProposalError extends Error {
  constructor(
    readonly problem: TradeProposalProblem,
    /** unavailable / missing_copies: las cartas afectadas (oracleId). */
    readonly oracleIds: string[] = [],
  ) {
    super(MESSAGES[problem]);
    this.name = "TradeProposalError";
  }
}

export interface ProposalDeps extends TradeDeps {
  profiles: ProfileRepository;
  /** Si alguno de los dos ha bloqueado al otro, no hay propuestas (fase 21). */
  blocks?: Pick<BlockRepository, "eitherBlocked"> | undefined;
  notifications: NotificationRepository;
  proposals: TradeProposalRepository;
}

/** Una línea tal y como la manda la UI, desde el punto de vista de quien la manda. */
export interface ProposalLineInput extends CopyKey {
  side: "give" | "get";
  quantity: number;
}

/**
 * Mis copias para cambiar, una a una, con el precio de cada copia: el de su impresión (foil si
 * es foil) o, si no se sabe, el de la impresión más barata de la carta.
 */
export async function tradeCopiesOf(
  userId: string,
  deps: TradeDeps,
): Promise<{ copies: TradeCopy[]; wishlist: ListedCard[] }> {
  const [lists, entries] = await Promise.all([
    userLists(userId, deps),
    deps.collectionFor(userId).entries(),
  ]);
  const listed = new Set(lists.tradelist.map((t) => t.oracleId));
  const owned = entries.filter((e) => listed.has(e.oracleId));
  const ids = [...new Set(owned.flatMap((e) => (e.scryfallId ? [e.scryfallId] : [])))];
  const [printings, minPrices] = await Promise.all([
    ids.length > 0 ? deps.cards.findPrintingsByIds(ids) : Promise.resolve([]),
    deps.cards.findMinPrices([...listed]),
  ]);
  const byPrinting = new Map(printings.map((p) => [p.scryfallId.toLowerCase(), p]));
  const copies = buildTradeCopies({
    owned: owned.map((e) => ({
      oracleId: e.oracleId,
      scryfallId: e.scryfallId?.toLowerCase() ?? null,
      foil: e.foil,
      language: e.language,
      quantity: e.quantity,
    })),
    tradelist: lists.tradelist,
    priceOf: (c) => {
      const p = c.scryfallId ? byPrinting.get(c.scryfallId) : undefined;
      return (p ? printingPrice(p, c.foil) : null) ?? minPrices.get(c.oracleId) ?? null;
    },
  });
  return { copies, wishlist: lists.wishlist };
}

async function partnerByUsername(viewerId: string, username: string, deps: ProposalDeps) {
  const partner = await deps.profiles.byUsername(username.toLowerCase());
  if (!partner?.username) throw new TradeProposalError("not_found");
  if (partner.id === viewerId) throw new TradeProposalError("self");
  if (!partner.tradesPublic) throw new TradeProposalError("private");
  if (await deps.blocks?.eitherBlocked(viewerId, partner.id)) {
    throw new TradeProposalError("blocked");
  }
  return partner as PublicProfile & { username: string };
}

export interface TradeCalculator {
  partner: PublicProfile & { username: string };
  /** Propuesta inicial ya cuadrada. */
  sides: TradeSides;
  balance: TradeBalance;
  /** Antes de cuadrar: todo lo que cruza. */
  matched: TradeSides;
  /** Todo lo que cada uno tiene para cambiar (para añadir a mano). */
  myCopies: TradeCopy[];
  theirCopies: TradeCopy[];
  /** Ya hay una propuesta abierta entre los dos (borrador mío o pendiente). */
  openProposalId: string | null;
}

/** La calculadora: propuesta inicial con otro usuario, cuadrada por valor. */
export async function tradeCalculator(
  viewerId: string,
  username: string,
  deps: ProposalDeps,
): Promise<TradeCalculator> {
  const partner = await partnerByUsername(viewerId, username, deps);
  const [mine, theirs, open] = await Promise.all([
    tradeCopiesOf(viewerId, deps),
    tradeCopiesOf(partner.id, deps),
    deps.proposals.openBetween(viewerId, partner.id),
  ]);
  const matched = proposeTrade({
    myWishlist: mine.wishlist,
    myCopies: mine.copies,
    theirWishlist: theirs.wishlist,
    theirCopies: theirs.copies,
  });
  const sides = balanceTrade(matched);
  return {
    partner,
    sides,
    balance: tradeBalance(sides),
    matched,
    myCopies: mine.copies,
    theirCopies: theirs.copies,
    openProposalId: open?.id ?? null,
  };
}

/** Comprueba las líneas contra lo que cada uno tiene para cambiar y les pone precio. */
async function priceLines(
  viewerId: string,
  otherId: string,
  lines: readonly ProposalLineInput[],
  deps: ProposalDeps,
): Promise<ProposalItem[]> {
  const [mine, theirs] = await Promise.all([
    tradeCopiesOf(viewerId, deps),
    tradeCopiesOf(otherId, deps),
  ]);
  const give = priceItems(
    lines.filter((l) => l.side === "give"),
    mine.copies,
  );
  const get = priceItems(
    lines.filter((l) => l.side === "get"),
    theirs.copies,
  );
  const problems = [...give.problems, ...get.problems];
  if (problems.length > 0) {
    throw new TradeProposalError("unavailable", [...new Set(problems.map((p) => p.oracleId))]);
  }
  const items = [
    ...give.items.map((i) => ({ ...i, giverId: viewerId })),
    ...get.items.map((i) => ({ ...i, giverId: otherId })),
  ];
  if (items.length === 0) throw new TradeProposalError("empty");
  return items;
}

const otherOf = (p: TradeProposal, userId: string) =>
  p.fromUserId === userId ? p.toUserId : p.fromUserId;

async function notify(
  deps: ProposalDeps,
  p: { id: string },
  from: string,
  to: string,
  type: NotificationType,
) {
  await deps.notifications.create([
    { userId: to, actorId: from, type, tradeId: p.id, title: "Propuesta de intercambio" },
  ]);
}

/** Crea una propuesta (borrador o enviada) para otro usuario con listas públicas. */
export async function createProposal(
  viewerId: string,
  input: { username: string; lines: readonly ProposalLineInput[]; send: boolean },
  deps: ProposalDeps,
): Promise<string> {
  const partner = await partnerByUsername(viewerId, input.username, deps);
  const items = await priceLines(viewerId, partner.id, input.lines, deps);
  const id = await deps.proposals.create({
    fromUserId: viewerId,
    toUserId: partner.id,
    status: input.send ? "pending" : "draft",
    turnUserId: input.send ? partner.id : null,
    items,
  });
  if (input.send) await notify(deps, { id }, viewerId, partner.id, "trade_proposal");
  return id;
}

/** Una propuesta que puedo ver: soy una de las dos partes (y, si es borrador, soy quien la hizo). */
export async function getProposal(
  viewerId: string,
  id: string,
  deps: Pick<ProposalDeps, "proposals">,
): Promise<TradeProposal> {
  const p = await deps.proposals.get(id);
  if (!p || (p.fromUserId !== viewerId && p.toUserId !== viewerId)) {
    throw new TradeProposalError("not_found");
  }
  if (p.status === "draft" && p.fromUserId !== viewerId) throw new TradeProposalError("not_found");
  return p;
}

/** Qué puedo hacer con una propuesta. */
export function proposalActions(p: TradeProposal, viewerId: string) {
  const mine = p.fromUserId === viewerId;
  const myTurn = p.status === "pending" && p.turnUserId === viewerId;
  return {
    /** Borrador: guardar cambios, enviar o borrar. */
    edit: p.status === "draft" && mine,
    /** Pendiente y me toca: aceptar, rechazar o contraproponer. */
    respond: myTurn,
    /** Pendiente: cualquiera de los dos la puede retirar. */
    cancel: p.status === "pending",
  };
}

export type ProposalAction =
  | { action: "save"; lines: readonly ProposalLineInput[] }
  | { action: "send"; lines?: readonly ProposalLineInput[] | undefined }
  | { action: "counter"; lines: readonly ProposalLineInput[] }
  | { action: "accept" | "reject" | "cancel" | "delete" };

/** Guardar / enviar un borrador, aceptar, rechazar, contraproponer, retirar o borrar. */
export async function actOnProposal(
  viewerId: string,
  id: string,
  act: ProposalAction,
  deps: ProposalDeps,
): Promise<void> {
  const p = await getProposal(viewerId, id, deps);
  const can = proposalActions(p, viewerId);
  const other = otherOf(p, viewerId);
  if (["accepted", "rejected", "cancelled"].includes(p.status)) {
    throw new TradeProposalError("closed");
  }
  switch (act.action) {
    case "save":
    case "send": {
      if (!can.edit) throw new TradeProposalError("forbidden");
      const items = act.lines ? await priceLines(viewerId, other, act.lines, deps) : undefined;
      if (act.action === "send" && !items && p.items.length === 0) {
        throw new TradeProposalError("empty");
      }
      const send = act.action === "send";
      await deps.proposals.update(id, {
        items,
        byUserId: viewerId,
        status: send ? "pending" : "draft",
        turnUserId: send ? other : null,
      });
      if (send) await notify(deps, p, viewerId, other, "trade_proposal");
      return;
    }
    case "delete":
      if (!can.edit) throw new TradeProposalError("forbidden");
      await deps.proposals.delete(id);
      return;
    case "counter": {
      if (!can.respond) throw new TradeProposalError("not_your_turn");
      const items = await priceLines(viewerId, other, act.lines, deps);
      await deps.proposals.update(id, {
        items,
        newVersion: true,
        byUserId: viewerId,
        status: "pending",
        turnUserId: other,
      });
      await notify(deps, p, viewerId, other, "trade_counter");
      return;
    }
    case "accept": {
      if (!can.respond) throw new TradeProposalError("not_your_turn");
      // Lo que se da tiene que seguir en "para cambiar" (no metido en un mazo ni marcado).
      const [mine, theirs] = await Promise.all([
        tradeCopiesOf(viewerId, deps),
        tradeCopiesOf(other, deps),
      ]);
      const gone = stillAvailable(sidesFor(p, viewerId), mine.copies, theirs.copies);
      if (gone.length > 0) throw new TradeProposalError("unavailable", gone);
      try {
        await deps.proposals.accept(id);
      } catch (err) {
        if (err instanceof MissingCopiesError) {
          throw new TradeProposalError("missing_copies", err.oracleIds);
        }
        if (err instanceof ProposalNotPendingError) throw new TradeProposalError("closed");
        throw err;
      }
      await clearReceivedWishes(p, deps);
      await notify(deps, p, viewerId, other, "trade_accepted");
      return;
    }
    case "reject":
      if (!can.respond) throw new TradeProposalError("not_your_turn");
      await deps.proposals.update(id, { byUserId: viewerId, status: "rejected", turnUserId: null });
      await notify(deps, p, viewerId, other, "trade_rejected");
      return;
    case "cancel":
      if (!can.cancel) throw new TradeProposalError("forbidden");
      await deps.proposals.update(id, {
        byUserId: viewerId,
        status: "cancelled",
        turnUserId: null,
      });
      await notify(deps, p, viewerId, other, "trade_cancelled");
      return;
  }
}

/** Lo recibido deja de estar en la lista de deseos manual de quien lo recibe. */
async function clearReceivedWishes(p: TradeProposal, deps: ProposalDeps) {
  for (const userId of [p.fromUserId, p.toUserId]) {
    const received = new Map<string, number>();
    for (const i of p.items) {
      if (i.giverId !== userId)
        received.set(i.oracleId, (received.get(i.oracleId) ?? 0) + i.quantity);
    }
    if (received.size === 0) continue;
    const trades = deps.tradesFor(userId);
    for (const w of await trades.wishes()) {
      const got = received.get(w.oracleId);
      if (got) await trades.setWish(w.oracleId, Math.max(0, w.quantity - got));
    }
  }
}

/** Las líneas de una propuesta vistas por un usuario: lo que da y lo que recibe. */
export function sidesFor(p: Pick<TradeProposal, "items">, viewerId: string): TradeSides {
  return {
    give: p.items.filter((i) => i.giverId === viewerId),
    get: p.items.filter((i) => i.giverId !== viewerId),
  };
}

export interface ProposalView {
  proposal: TradeProposal;
  /** El otro usuario. */
  partner: PublicProfile;
  sides: TradeSides;
  balance: TradeBalance;
  actions: ReturnType<typeof proposalActions>;
  /** Si puedo editarla (borrador o contrapropuesta): lo que cada uno tiene para cambiar. */
  myCopies: TradeCopy[] | null;
  theirCopies: TradeCopy[] | null;
  /** Cartas de la propuesta que ya no están disponibles (para avisar antes de aceptar). */
  unavailable: string[];
}

/** Una propuesta con todo lo necesario para verla y, si me toca, editarla. */
export async function proposalView(
  viewerId: string,
  id: string,
  deps: ProposalDeps,
): Promise<ProposalView> {
  const proposal = await getProposal(viewerId, id, deps);
  const otherId = otherOf(proposal, viewerId);
  const partner = await deps.profiles.byId(otherId);
  if (!partner) throw new TradeProposalError("not_found");
  const actions = proposalActions(proposal, viewerId);
  const sides = sidesFor(proposal, viewerId);
  const open = proposal.status === "draft" || proposal.status === "pending";
  const [mine, theirs] = open
    ? await Promise.all([tradeCopiesOf(viewerId, deps), tradeCopiesOf(otherId, deps)])
    : [null, null];
  const unavailable = mine && theirs ? stillAvailable(sides, mine.copies, theirs.copies) : [];
  const editable = actions.edit || actions.respond;
  return {
    proposal,
    partner,
    sides,
    balance: tradeBalance(sides),
    actions,
    myCopies: editable ? (mine?.copies ?? null) : null,
    theirCopies: editable ? (theirs?.copies ?? null) : null,
    unavailable,
  };
}

/** Cartas de la propuesta que ya no están en "para cambiar" de quien las da. */
function stillAvailable(
  sides: TradeSides,
  mine: readonly TradeCopy[],
  theirs: readonly TradeCopy[],
): string[] {
  const check = (items: readonly TradeCopy[], copies: readonly TradeCopy[]) =>
    priceItems(items, copies).problems.map((p) => p.oracleId);
  return [...new Set([...check(sides.give, mine), ...check(sides.get, theirs)])];
}

/** Mis propuestas (enviadas y recibidas; mis borradores), con el otro usuario y el balance. */
export async function myProposals(viewerId: string, deps: ProposalDeps) {
  const list = await deps.proposals.listFor(viewerId);
  const partners = new Map<string, PublicProfile | null>();
  for (const p of list) {
    const id = otherOf(p, viewerId);
    if (!partners.has(id)) partners.set(id, await deps.profiles.byId(id));
  }
  return list.flatMap((p) => {
    const partner = partners.get(otherOf(p, viewerId));
    if (!partner) return [];
    const sides = sidesFor(p, viewerId);
    return [
      {
        proposal: p,
        partner,
        sides,
        balance: tradeBalance(sides),
        actions: proposalActions(p, viewerId),
      },
    ];
  });
}
