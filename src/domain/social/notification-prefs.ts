import type { NotificationType } from "../ports/social";

/** Grupos de avisos que se pueden silenciar en Ajustes (lo que ve el usuario). */
export const NOTIFICATION_GROUPS = {
  follows: ["new_deck", "big_card"],
  prices: ["price_drop"],
  trades: ["trade_match"],
  proposals: [
    "trade_proposal",
    "trade_counter",
    "trade_accepted",
    "trade_rejected",
    "trade_cancelled",
  ],
  groups: ["group_join", "game_recorded"],
  comments: ["deck_comment"],
  loans: ["loan_new"],
} as const satisfies Record<string, readonly NotificationType[]>;

export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS;

export const NOTIFICATION_GROUP_KEYS = Object.keys(NOTIFICATION_GROUPS) as NotificationGroup[];

const isGroup = (g: string): g is NotificationGroup => g in NOTIFICATION_GROUPS;

/** Lee la columna (`"prices,loans"`), ignorando lo que no sea un grupo conocido. */
export function parseMutedGroups(stored: string): NotificationGroup[] {
  return [...new Set(stored.split(",").map((g) => g.trim()))].filter(isGroup);
}

export const formatMutedGroups = (groups: readonly NotificationGroup[]) =>
  NOTIFICATION_GROUP_KEYS.filter((g) => groups.includes(g)).join(",");

/** ¿Ese tipo de aviso está en algún grupo silenciado? */
export function isMuted(type: NotificationType, muted: readonly NotificationGroup[]): boolean {
  return muted.some((g) => (NOTIFICATION_GROUPS[g] as readonly NotificationType[]).includes(type));
}
