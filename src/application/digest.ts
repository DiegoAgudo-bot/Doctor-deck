import type { NotificationRepository, ProfileRepository } from "@/domain/ports/social";
import { DIGEST_EVERY_DAYS, digestEmail, type DigestItem } from "@/domain/social/digest";
import { notificationMessage } from "@/domain/social/notification-text";

export interface DigestDeps {
  profiles: Pick<ProfileRepository, "digestUsers" | "markDigestSent">;
  notifications: Pick<NotificationRepository, "listSince">;
  mailer: {
    send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
  };
  /** URL pública de la web, sin barra final. */
  siteUrl: string;
}

/**
 * Resumen semanal por correo: a quien lo ha activado (y tiene el email verificado), los avisos de
 * los últimos 7 días, como mucho una vez cada 7 días. Sin avisos no se manda nada (ni se cuenta
 * como enviado: llegará cuando haya algo). Si un correo falla, se sigue con los demás. Devuelve
 * cuántos se mandaron.
 */
export async function sendWeeklyDigests(deps: DigestDeps, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - DIGEST_EVERY_DAYS * 86_400_000);
  let sent = 0;
  for (const user of await deps.profiles.digestUsers(since)) {
    const notifications = await deps.notifications.listSince(user.id, since, 100);
    if (notifications.length === 0) continue;
    const items = notifications.map((n): DigestItem => {
      const who = n.actor.username ? `@${n.actor.username}` : n.actor.name;
      const es = notificationMessage(n, who, "es");
      const en = notificationMessage(n, who, "en");
      return {
        es: { title: es.title, body: es.body },
        en: { title: en.title, body: en.body },
        path: es.path,
      };
    });
    try {
      await deps.mailer.send({
        to: user.email,
        ...digestEmail({ name: user.name, items, siteUrl: deps.siteUrl }),
      });
      await deps.profiles.markDigestSent(user.id, now);
      sent++;
    } catch {
      // Se intentará en la próxima ejecución (no se marca como enviado).
    }
  }
  return sent;
}
