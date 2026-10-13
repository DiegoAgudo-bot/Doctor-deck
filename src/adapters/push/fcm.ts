import { createSign } from "node:crypto";
import { z } from "zod";
import type { PushMessage, PushSender } from "@/domain/ports/push";

/** Lo que se usa de la clave de cuenta de servicio de Firebase (JSON descargado de la consola). */
const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});
export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

/** `FCM_SERVICE_ACCOUNT`: el JSON tal cual o en base64 (más cómodo como secreto). */
export function parseServiceAccount(raw: string): ServiceAccount {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return serviceAccountSchema.parse(JSON.parse(text));
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TIMEOUT_MS = 10_000;
/** Peticiones a la vez (FCM v1 manda de una en una). */
const CONCURRENCY = 8;

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/**
 * Notificaciones push con Firebase Cloud Messaging (API HTTP v1). Se autentica con la cuenta de
 * servicio (JWT firmado con su clave → token OAuth de 1 h, que se reutiliza).
 */
export class FcmSender implements PushSender {
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly account: ServiceAccount,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
      JSON.stringify({
        iss: this.account.client_email,
        scope: SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    )}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(this.account.private_key);
    const res = await this.fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${unsigned}.${b64url(signature)}`,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Firebase no ha dado acceso (${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  async send(messages: readonly PushMessage[]) {
    if (messages.length === 0) return { invalidTokens: [] };
    const token = await this.token();
    const url = `https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`;
    const invalidTokens: string[] = [];
    const errors: string[] = [];
    const sendOne = async (m: PushMessage) => {
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: m.token,
            notification: { title: m.title, body: m.body },
            data: m.data,
            android: { priority: "high", notification: { channel_id: "default" } },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return;
      const body = (await res.json().catch(() => null)) as {
        error?: { status?: string; details?: { errorCode?: string }[] };
      } | null;
      const code = body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? body?.error?.status;
      // App desinstalada o token caducado: se borra para no volver a intentarlo.
      if (res.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") {
        invalidTokens.push(m.token);
      } else {
        errors.push(`${res.status} ${code ?? ""}`.trim());
      }
    };
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
      await Promise.all(messages.slice(i, i + CONCURRENCY).map(sendOne));
    }
    if (errors.length > 0 && invalidTokens.length + errors.length === messages.length) {
      throw new Error(`Firebase no ha enviado las notificaciones: ${errors[0]}`);
    }
    return { invalidTokens };
  }
}
