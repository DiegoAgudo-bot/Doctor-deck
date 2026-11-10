/** El correo del resumen semanal: lo que ha pasado esta semana, en español y en inglés. */
export interface DigestItem {
  es: { title: string; body: string };
  en: { title: string; body: string };
  /** Ruta de la web a la que lleva (sin dominio). */
  path: string;
}

export const DIGEST_MAX_ITEMS = 15;
/** Días entre un resumen y el siguiente. */
export const DIGEST_EVERY_DAYS = 7;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Asunto, texto y HTML del resumen. `siteUrl` sin barra final. Va en los dos idiomas (no sabemos
 * cuál usa cada cuenta), con el enlace a Ajustes para dejar de recibirlo.
 */
export function digestEmail(input: {
  name: string;
  items: readonly DigestItem[];
  siteUrl: string;
}): { subject: string; text: string; html: string } {
  const shown = input.items.slice(0, DIGEST_MAX_ITEMS);
  const more = input.items.length - shown.length;
  const url = (path: string) => `${input.siteUrl}${path}`;
  const block = (lang: "es" | "en") => {
    const en = lang === "en";
    const lines = shown.map((i) => `- ${i[lang].title}: ${i[lang].body}\n  ${url(i.path)}`);
    return [
      en
        ? `Hi ${input.name}, this was your week on Doctor Deck:`
        : `Hola, ${input.name}. Tu semana en Doctor Deck:`,
      "",
      ...lines,
      ...(more > 0
        ? [
            en
              ? `…and ${more} more: ${url("/notifications")}`
              : `…y ${more} más: ${url("/notifications")}`,
          ]
        : []),
      "",
      en
        ? `To stop these emails, turn off the weekly summary in Settings: ${url("/en/settings")}`
        : `Para dejar de recibir este correo, desactiva el resumen semanal en Ajustes: ${url("/settings")}`,
    ].join("\n");
  };
  const htmlBlock = (lang: "es" | "en") => {
    const en = lang === "en";
    const rows = shown
      .map(
        (i) =>
          `<li style="margin:0 0 10px"><a href="${escapeHtml(url(i.path))}" style="color:#0b63c9;font-weight:600;text-decoration:none">${escapeHtml(i[lang].title)}</a><br><span style="color:#55524d">${escapeHtml(i[lang].body)}</span></li>`,
      )
      .join("");
    return [
      `<p style="margin:0 0 12px">${escapeHtml(en ? `Hi ${input.name}, this was your week on Doctor Deck:` : `Hola, ${input.name}. Tu semana en Doctor Deck:`)}</p>`,
      `<ul style="margin:0 0 12px;padding-left:18px">${rows}</ul>`,
      more > 0
        ? `<p style="margin:0 0 12px"><a href="${escapeHtml(url("/notifications"))}" style="color:#0b63c9">${en ? `…and ${more} more` : `…y ${more} más`}</a></p>`
        : "",
      `<p style="margin:0;color:#6f6b65;font-size:12px">${en ? "To stop these emails, turn off the weekly summary in" : "Para dejar de recibir este correo, desactiva el resumen semanal en"} <a href="${escapeHtml(url(en ? "/en/settings" : "/settings"))}" style="color:#6f6b65">${en ? "Settings" : "Ajustes"}</a>.</p>`,
    ].join("");
  };
  return {
    subject: "Tu semana en Doctor Deck · Your week on Doctor Deck",
    text: `${block("es")}\n\n— — —\n\n${block("en")}\n`,
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;color:#1c1b19;max-width:560px">${htmlBlock("es")}<hr style="border:0;border-top:1px solid #e1e1e4;margin:20px 0">${htmlBlock("en")}</div>`,
  };
}
