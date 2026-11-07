import type { Locale } from "../i18n/locale";
import { roleLabel } from "../i18n/labels";
import type { Role } from "../roles/types";
import type { ScoredCard } from "./engine";

const pct = (x: number) => `${Math.round(x * 100)} %`;
const pctEn = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => {
  const v = Math.round(x * 100);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}`;
};

function describeOut(c: ScoredCard, l: Locale): string {
  const role = roleLabel(c.roles.primary, l);
  const en = l === "en";
  if (c.problem === "offColor") {
    return en
      ? `${role}, outside the commander's color identity`
      : `${role}, fuera de la identidad de color del comandante`;
  }
  if (c.problem === "notLegal")
    return en ? `${role}, banned in Commander` : `${role}, prohibida en Commander`;
  if (!c.inEdhrec) {
    return en
      ? `${role}, hardly anyone plays it with this commander`
      : `${role}, casi nadie la juega con este comandante`;
  }
  const parts = [
    role,
    en ? `${pctEn(c.inclusion ?? 0)} inclusion` : `${pct(c.inclusion ?? 0)} inclusión`,
  ];
  if (c.synergy !== null && c.synergy < 0) parts.push(`${signed(c.synergy)} synergy`);
  return parts.join(", ");
}

function describeIn(c: ScoredCard, l: Locale): string {
  const parts = [
    roleLabel(c.roles.primary, l),
    l === "en" ? `${pctEn(c.inclusion ?? 0)} inclusion` : `${pct(c.inclusion ?? 0)} inclusión`,
  ];
  if (c.synergy !== null) parts.push(`${signed(c.synergy)} synergy`);
  return parts.join(", ");
}

/** Motivo legible de un cambio, en el idioma pedido (español por defecto). */
export function swapReason(
  swap: { out: ScoredCard; in: ScoredCard; sameRole: boolean; fillsDeficit: Role[] },
  ctx: { counts: Record<Role, number>; minimums: Partial<Record<Role, number>> },
  /** Frase sobre cómo conseguir la carta ("La tienes en tu colección." / precio). */
  acquisition: string,
  locale: Locale = "es",
): string {
  const { out, in: inn } = swap;
  const en = locale === "en";
  const role = (r: Role) => roleLabel(r, locale);
  const sentences = [
    en
      ? `Replace ${out.card.name} (${describeOut(out, locale)}) with ${inn.card.name} (${describeIn(inn, locale)}).`
      : `Sustituye a ${out.card.name} (${describeOut(out, locale)}) por ${inn.card.name} (${describeIn(inn, locale)}).`,
    acquisition,
  ];
  if (!swap.sameRole) {
    sentences.push(
      en
        ? `Trades ${role(out.roles.primary)} for ${role(inn.roles.primary)}.`
        : `Cambia ${role(out.roles.primary)} por ${role(inn.roles.primary)}.`,
    );
  }
  for (const r of swap.fillsDeficit) {
    sentences.push(
      en
        ? `Brings ${role(r)} up to ${ctx.counts[r]} (minimum ${ctx.minimums[r] ?? 0}).`
        : `Sube ${role(r)} a ${ctx.counts[r]} (mínimo ${ctx.minimums[r] ?? 0}).`,
    );
  }
  return sentences.join(" ");
}
