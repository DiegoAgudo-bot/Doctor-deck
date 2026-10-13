/** Móviles con la app instalada (fase 22). */
export type PushPlatform = "android" | "ios";

export interface PushDeviceRepository {
  /** Guarda (o mueve a esta cuenta) el token del dispositivo. */
  register(
    userId: string,
    device: { token: string; platform: PushPlatform; appVersion: string | null },
  ): Promise<void>;
  /** Al cerrar sesión en la app: solo si el token es de esa cuenta. */
  unregister(userId: string, token: string): Promise<void>;
  /** Tokens de los dispositivos de esas personas. */
  tokensFor(userIds: readonly string[]): Promise<{ userId: string; token: string }[]>;
  /** Tokens que el servicio de push dice que ya no valen. */
  remove(tokens: readonly string[]): Promise<void>;
  /** "@usuario" o el nombre de cada persona (para el texto del aviso). */
  labels(userIds: readonly string[]): Promise<Map<string, string>>;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  /** Datos para la app al tocar la notificación (p. ej. `path`). */
  data: Record<string, string>;
}

export interface PushSender {
  /** Manda los mensajes; devuelve los tokens que ya no existen (app desinstalada…). */
  send(messages: readonly PushMessage[]): Promise<{ invalidTokens: string[] }>;
}
