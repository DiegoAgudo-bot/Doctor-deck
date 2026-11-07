import type { Mailer } from "@/adapters/mail/mailer";
import type { ErrorReport } from "@/domain/errors/report";
import type { ErrorLog } from "@/domain/ports/error-log";

/** Emails como mucho por hora (si algo se rompe del todo, no llenar el buzón). */
const MAX_PER_HOUR = 5;

/**
 * El registro de errores que, además, avisa por email a los administradores (`ADMIN_EMAILS`) la
 * primera vez que aparece un error (una huella nueva). Los repetidos solo suman en /admin/errors.
 * Sin correo o sin administradores, es el registro tal cual. El envío nunca hace fallar al registro.
 */
export function withErrorAlerts(
  log: ErrorLog,
  opts: { mailer: Mailer | null; admins: readonly string[]; siteUrl: string; now?: () => number },
): ErrorLog {
  const { mailer, admins } = opts;
  if (!mailer || admins.length === 0) return log;
  const now = opts.now ?? Date.now;
  let sent: number[] = [];
  return {
    list: (limit) => log.list(limit),
    clear: (id) => log.clear(id),
    async record(report: ErrorReport, at?: Date) {
      const isNew = await log.record(report, at);
      if (!isNew) return false;
      const t = now();
      sent = sent.filter((s) => t - s < 3_600_000);
      if (sent.length >= MAX_PER_HOUR) return true;
      sent.push(t);
      const where = report.source === "server" ? "servidor" : "navegador";
      const subject = `Doctor Deck · error nuevo (${where}): ${report.message.slice(0, 80)}`;
      const text = [
        `Error nuevo en el ${where}${report.path ? ` en ${report.path}` : ""}:`,
        "",
        report.message,
        "",
        report.stack ? report.stack.split("\n").slice(0, 12).join("\n") : "(sin traza)",
        "",
        `Todos los errores: ${new URL("/admin/errors", opts.siteUrl).toString()}`,
        `Solo se avisa la primera vez de cada error (como mucho ${MAX_PER_HOUR} por hora).`,
      ].join("\n");
      for (const to of admins) {
        void mailer.send({ to, subject, text }).catch((err: unknown) => {
          console.error("No se pudo mandar el aviso de error:", err);
        });
      }
      return true;
    },
  };
}
