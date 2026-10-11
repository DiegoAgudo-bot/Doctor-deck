import type { CardRepository } from "@/domain/ports/card-repository";
import type { CollectionRepository } from "@/domain/ports/collection-repository";
import type { DeckRepository } from "@/domain/ports/deck-repository";
import type { LoanRepository } from "@/domain/ports/loans";
import type { BlockRepository } from "@/domain/ports/moderation";
import type { NotificationRepository, ProfileRepository } from "@/domain/ports/social";
import { AppError, notFound } from "./errors";

export interface LoanDeps {
  loans: LoanRepository;
  cards: CardRepository;
  profiles: ProfileRepository;
  notifications: NotificationRepository;
  blocks: Pick<BlockRepository, "eitherBlocked">;
  collectionFor: (userId: string) => CollectionRepository;
  decksFor: (userId: string) => DeckRepository;
}

/**
 * Presto copias de una carta a un usuario (`@ana`) o a alguien sin cuenta (solo el nombre).
 * Solo puedo prestar las que tengo libres (ni en mazos ni ya prestadas). Siguen en mi colección,
 * pero cuentan como ocupadas hasta que las marco como devueltas.
 */
export async function lendCard(
  lenderId: string,
  input: { oracleId: string; quantity: number; to: string; note?: string | undefined },
  deps: LoanDeps,
) {
  const [card] = await deps.cards.findCardsByOracleIds([input.oracleId]);
  if (!card) throw notFound("Esa carta no existe.");
  const to = input.to.trim();
  if (!to) throw new AppError("invalid_loan", "¿A quién se la prestas?");
  let borrowerId: string | null = null;
  let borrowerName: string | null = null;
  if (to.startsWith("@")) {
    const user = await deps.profiles.byUsername(to.slice(1).toLowerCase());
    if (!user) throw notFound(`No hay nadie con el usuario ${to}.`);
    if (user.id === lenderId) throw new AppError("invalid_loan", "No puedes prestarte a ti mismo.");
    if (await deps.blocks.eitherBlocked(lenderId, user.id)) {
      throw new AppError("blocked", "No puedes prestar cartas a esta persona.", 403);
    }
    borrowerId = user.id;
  } else {
    borrowerName = to.replace(/\s+/g, " ").slice(0, 40);
  }
  const [owned, usage] = await Promise.all([
    deps.collectionFor(lenderId).ownedQuantities(),
    deps.decksFor(lenderId).usage(),
  ]);
  const free = (owned.get(card.oracleId) ?? 0) - (usage.get(card.oracleId)?.quantity ?? 0);
  if (input.quantity > free) {
    throw new AppError(
      "not_free",
      free > 0
        ? `Solo tienes ${free} ${free === 1 ? "copia libre" : "copias libres"} de ${card.name}.`
        : `No tienes copias libres de ${card.name} (están en tus mazos o ya prestadas).`,
      409,
    );
  }
  const id = await deps.loans.create({
    lenderId,
    borrowerId,
    borrowerName,
    oracleId: card.oracleId,
    name: card.name,
    quantity: input.quantity,
    note: (input.note ?? "").trim().slice(0, 200),
  });
  if (borrowerId) {
    await deps.notifications.create([
      { userId: borrowerId, actorId: lenderId, type: "loan_new", title: card.name, refId: id },
    ]);
  }
  return id;
}

export const myLoans = (userId: string, includeReturned: boolean, deps: Pick<LoanDeps, "loans">) =>
  deps.loans.forUser(userId, includeReturned);

/**
 * Devuelta: la marca quien prestó o quien la tiene. Borrar (si me equivoqué): solo quien prestó.
 */
export async function closeLoan(
  id: string,
  viewerId: string,
  action: "returned" | "delete",
  deps: Pick<LoanDeps, "loans">,
) {
  const loan = await deps.loans.get(id);
  const isLender = loan?.lenderId === viewerId;
  if (!loan || (!isLender && loan.borrower?.id !== viewerId))
    throw notFound("Ese préstamo no existe.");
  if (action === "delete") {
    if (!isLender) throw new AppError("forbidden", "Solo quien la prestó puede borrarlo.", 403);
    await deps.loans.delete(id);
  } else {
    await deps.loans.markReturned(id);
  }
}
