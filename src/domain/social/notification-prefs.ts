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

/** Qué avisos puedo silenciar (`NOTIFICATION_GROUPS`), con lo que ve el usuario. */
export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroup, { label: string; hint: string }> =
  {
    follows: {
      label: "Gente que sigo",
      hint: "Mazos nuevos y cartas caras que añaden a su colección.",
    },
    prices: { label: "Bajadas de precio", hint: "De cartas que te faltan para tus mazos." },
    trades: { label: "Cruces de intercambio", hint: "Alguien tiene algo de tu lista de deseos." },
    proposals: {
      label: "Propuestas de intercambio",
      hint: "Te mandan una, la contraproponen, la aceptan…",
    },
    groups: {
      label: "Grupos y partidas",
      hint: "Alguien entra en tu grupo o te apunta a una partida.",
    },
    comments: { label: "Comentarios en tus mazos", hint: "" },
    loans: { label: "Préstamos", hint: "Alguien te presta una carta." },
  };

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
