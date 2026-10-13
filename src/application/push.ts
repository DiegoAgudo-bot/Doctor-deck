import { notificationMessage } from "@/domain/social/notification-text";
import type { PushDeviceRepository, PushSender } from "@/domain/ports/push";
import type { NewNotification } from "@/domain/ports/social";

/**
 * Cada aviso nuevo, también como notificación push a los móviles de quien lo recibe (el mismo
 * texto que en la app). Los tokens que ya no valen se borran.
 */
export async function pushNotifications(
  items: readonly NewNotification[],
  deps: { devices: PushDeviceRepository; sender: PushSender },
): Promise<{ sent: number }> {
  if (items.length === 0) return { sent: 0 };
  const tokens = await deps.devices.tokensFor([...new Set(items.map((n) => n.userId))]);
  if (tokens.length === 0) return { sent: 0 };
  const labels = await deps.devices.labels([...new Set(items.map((n) => n.actorId))]);
  const byUser = new Map<string, string[]>();
  for (const t of tokens) byUser.set(t.userId, [...(byUser.get(t.userId) ?? []), t.token]);

  const messages = items.flatMap((n) => {
    const m = notificationMessage(n, labels.get(n.actorId) ?? "Alguien");
    return (byUser.get(n.userId) ?? []).map((token) => ({
      token,
      title: m.title,
      body: m.body,
      data: { path: m.path, type: n.type },
    }));
  });
  const { invalidTokens } = await deps.sender.send(messages);
  if (invalidTokens.length > 0) await deps.devices.remove(invalidTokens);
  return { sent: messages.length - invalidTokens.length };
}
