/** Lo que costaban mis copias cuando las añadí y lo que valen hoy (`CollectionCard.sinceAdded`). */
export interface SinceAdded {
  paid: number;
  now: number;
  /** Día de la copia más antigua ("YYYY-MM-DD"). */
  since: string;
}

/** Cómo ha ido el precio desde que se añadió, listo para enseñarlo (web y app). */
export interface SinceAddedTrend {
  tone: "up" | "down" | "flat";
  /** "▲", "▼" o "=". */
  arrow: string;
  /** "+12 %", "−3,5 %", "0 %" (con espacio fino irrompible antes del %). */
  percent: string;
  /** "nov 2025". */
  month: string;
  /** "14 nov 2025". */
  day: string;
  /** Diferencia en euros (con signo). */
  diff: number;
}

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
];

const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2025-11-14" → "14 nov 2025" ("14 Nov 2025" en inglés). */
export function dayLabel(day: string, locale: "es" | "en" = "es"): string {
  const [y, m, d] = day.split("-");
  return `${Number(d)} ${(locale === "en" ? MONTHS_EN : MONTHS)[Number(m) - 1] ?? m} ${y}`;
}

/** null si no se sabe lo que costaban (o costaban 0). Menos de un 0,5 % cuenta como sin cambios. */
export function sinceAddedTrend(
  s: SinceAdded | null,
  locale: "es" | "en" = "es",
): SinceAddedTrend | null {
  if (!s || s.paid <= 0) return null;
  const diff = Math.round((s.now - s.paid) * 100) / 100;
  const pct = (diff / s.paid) * 100;
  const flat = Math.abs(pct) < 0.5;
  const abs = Math.abs(pct).toLocaleString(locale === "en" ? "en-GB" : "es-ES", {
    maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0,
  });
  const day = dayLabel(s.since, locale);
  const unit = locale === "en" ? "%" : " %";
  return {
    tone: flat ? "flat" : diff > 0 ? "up" : "down",
    arrow: flat ? "=" : diff > 0 ? "▲" : "▼",
    percent: flat ? `0${unit}` : `${diff > 0 ? "+" : "−"}${abs}${unit}`,
    month: day.replace(/^\d+ /, ""),
    day,
    diff,
  };
}
