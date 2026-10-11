/** Reglas de los comentarios en los mazos y de su moderación. */

export const COMMENT_MAX_LENGTH = 1000;
/** Con estas denuncias de personas distintas, el comentario se oculta hasta que se revise. */
export const REPORTS_TO_HIDE = 3;
/** Tiempo mínimo entre dos comentarios de la misma persona (contra el spam). */
export const COMMENT_COOLDOWN_MS = 15_000;
/** Como mucho tantos enlaces por comentario. */
export const COMMENT_MAX_LINKS = 2;

export const REPORT_REASONS = {
  spam: "Spam o publicidad",
  abuse: "Insultos o acoso",
  other: "Otro motivo",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export type CommentProblem = "empty" | "too_long" | "too_many_links";

/** Limpia el texto (espacios, saltos de línea de más) o dice qué le pasa. */
export function cleanComment(body: string): { body: string } | { problem: CommentProblem } {
  const text = body
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { problem: "empty" };
  if (text.length > COMMENT_MAX_LENGTH) return { problem: "too_long" };
  if ((text.match(/https?:\/\//gi) ?? []).length > COMMENT_MAX_LINKS) {
    return { problem: "too_many_links" };
  }
  return { body: text };
}

/** Si alguien que comentó en `last` puede volver a comentar ya. */
export const cooledDown = (last: Date | null, now: Date) =>
  !last || now.getTime() - last.getTime() >= COMMENT_COOLDOWN_MS;
