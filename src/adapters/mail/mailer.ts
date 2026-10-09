import nodemailer from "nodemailer";

export interface Mailer {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>;
}

/** Envío por SMTP (`SMTP_URL`, p. ej. smtps://usuario:clave@smtp.ejemplo.com:465). */
export function smtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send({ to, subject, text, html }) {
      await transport.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
    },
  };
}
