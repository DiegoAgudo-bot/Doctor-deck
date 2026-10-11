import { getContainer } from "./container";
import { currentUser, type SessionUser } from "./session";

/** Dependencias de los casos de uso de la fase 21 (grupos, partidas, préstamos, feed, comentarios). */
export function socialDeps() {
  const c = getContainer();
  return {
    cards: c.cards,
    collectionFor: (id: string) => c.collectionFor(id),
    decksFor: (id: string) => c.decksFor(id),
    tradesFor: (id: string) => c.tradesFor(id),
    profiles: c.social,
    follows: c.social,
    notifications: c.social,
    publicDecks: c.publicDecks,
    groups: c.groups,
    games: c.games,
    loans: c.loans,
    feed: c.feed,
    comments: c.moderation,
    blocks: c.moderation,
    reports: c.moderation,
  };
}

/** Si el usuario puede revisar denuncias (su email está en `ADMIN_EMAILS`). */
export const isAdmin = (user: SessionUser | null) =>
  !!user && getContainer().env.ADMIN_EMAILS.includes(user.email.toLowerCase());

export async function currentAdmin(req: Request) {
  const user = await currentUser(req);
  return isAdmin(user) ? user : null;
}
