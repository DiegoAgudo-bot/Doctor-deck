import { ROLE_LABELS, type Role } from "../roles/types";
import type { AddCandidate, ScoredCard } from "./engine";

const pct = (x: number) => `${Math.round(x * 100)} %`;
const signed = (x: number) => {
  const v = Math.round(x * 100);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}`;
};

function describeOut(c: ScoredCard): string {
  const role = ROLE_LABELS[c.roles.primary];
  if (c.problem === "offColor") return `${role}, fuera de la identidad de color del comandante`;
  if (c.problem === "notLegal") return `${role}, prohibida en Commander`;
  if (!c.inEdhrec) return `${role}, no aparece en EDHREC para este comandante`;
  const parts = [role, `${pct(c.inclusion ?? 0)} inclusión`];
  if (c.synergy !== null && c.synergy < 0) parts.push(`${signed(c.synergy)} synergy`);
  return parts.join(", ");
}

function describeIn(c: AddCandidate): string {
  const parts = [ROLE_LABELS[c.roles.primary], `${pct(c.inclusion ?? 0)} inclusión`];
  if (c.synergy !== null) parts.push(`${signed(c.synergy)} synergy`);
  return parts.join(", ");
}

/** Motivo legible de un cambio, en español. */
export function swapReason(
  swap: { out: ScoredCard; in: AddCandidate; sameRole: boolean; fillsDeficit: Role[] },
  ctx: { counts: Record<Role, number>; minimums: Partial<Record<Role, number>> },
): string {
  const { out, in: inn } = swap;
  const sentences = [
    `Sustituye a ${out.card.name} (${describeOut(out)}) por ${inn.card.name} (${describeIn(inn)}).`,
    inn.owned > 1
      ? `La tienes en tu colección (${inn.owned} copias).`
      : "La tienes en tu colección.",
  ];
  if (!swap.sameRole) {
    sentences.push(
      `Cambia ${ROLE_LABELS[out.roles.primary]} por ${ROLE_LABELS[inn.roles.primary]}.`,
    );
  }
  for (const role of swap.fillsDeficit) {
    sentences.push(
      `Sube ${ROLE_LABELS[role]} a ${ctx.counts[role]} (mínimo ${ctx.minimums[role] ?? 0}).`,
    );
  }
  return sentences.join(" ");
}
