import nodemailer from "nodemailer";

export interface Mailer {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

/** Tiempo máximo para conectar y para cada respuesta del servidor de correo. */
const TIMEOUT_MS = 15_000;

/**
 * El mailer de `SMTP_URL`. Si es el SMTP de Resend (`smtp.resend.com`, la contraseña es la API key)
 * se usa su API HTTPS: muchos VPS (Hetzner, entre otros) bloquean los puertos SMTP de salida y la
 * conexión se quedaba colgada sin dar error.
 */
export function createMailer(smtpUrl: string, from: string): Mailer {
  const url = new URL(smtpUrl);
  if (url.hostname === "smtp.resend.com" && url.password) {
    return resendMailer(decodeURIComponent(url.password), from);
  }
  return smtpMailer(smtpUrl, from);
}

/** Envío por SMTP (`SMTP_URL`, p. ej. smtps://usuario:clave@smtp.ejemplo.com:465). */
export function smtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport({
    url: smtpUrl,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return {
    async send({ to, subject, text, html }) {
      await transport.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
    },
  };
}

/** Envío con la API de Resend (`POST https://api.resend.com/emails`). */
export function resendMailer(apiKey: string, from: string, fetchFn: typeof fetch = fetch): Mailer {
  return {
    async send({ to, subject, text, html }) {
      const res = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        // Resend explica el motivo (dominio sin verificar, remitente no permitido…) en `message`.
        const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
        const reason = typeof body?.message === "string" ? body.message : res.statusText;
        throw new Error(`Resend no ha enviado el correo (${res.status}): ${reason}`);
      }
    },
  };
}
