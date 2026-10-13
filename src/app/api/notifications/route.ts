import { connection } from "next/server";
import { notificationMessage } from "@/domain/social/notification-text";
import { getContainer } from "@/server/container";
import type { NotificationsResponse } from "@/server/dto";
import { errorResponse } from "@/server/http";
import { requireUser } from "@/server/session";

/** Mis notificaciones (las 50 últimas) y cuántas hay sin leer. */
export async function GET(request: Request) {
  await connection();
  try {
    const user = await requireUser(request);
    const social = getContainer().social;
    const [items, unread] = await Promise.all([
      social.list(user.id, 50),
      social.unreadCount(user.id),
    ]);
    const body: NotificationsResponse = {
      unread,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        actor: n.actor,
        deckId: n.deckId,
        cardId: n.cardId,
        title: n.title,
        price: n.price,
        prevPrice: n.prevPrice,
        tradeId: n.tradeId,
        refId: n.refId,
        createdAt: n.createdAt.toISOString(),
        read: n.read,
        // Para la app: el texto ya montado y a qué pantalla lleva.
        message: notificationMessage(n, n.actor.username ? `@${n.actor.username}` : n.actor.name),
      })),
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
