import { intl, isEn } from "./lang.ts";

/** 12,50 € (en inglés, €12.50; como la web). */
export const euros = (x: number | null | undefined) =>
  x == null ? "—" : isEn ? `€${x.toFixed(2)}` : `${x.toFixed(2).replace(".", ",")} €`;

/** 1.234 (1,234 en inglés) */
export const thousands = (n: number) => n.toLocaleString(intl);

/** "hace 3 h", "hace 2 d"… ("3 h ago" en inglés) */
export function ago(iso: string, now = Date.now(), en = isEn): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const rel = (n: number, unit: string) => (en ? `${n} ${unit} ago` : `hace ${n} ${unit}`);
  if (s < 60) return en ? "now" : "ahora";
  if (s < 3600) return rel(Math.floor(s / 60), "min");
  if (s < 86_400) return rel(Math.floor(s / 3600), "h");
  if (s < 30 * 86_400) return rel(Math.floor(s / 86_400), "d");
  return new Date(iso).toLocaleDateString(en ? "en-GB" : "es-ES", {
    day: "numeric",
    month: "short",
  });
}

/** ¿`version` es anterior a `min`? (semver sin etiquetas). */
export function isOlder(version: string, min: string): boolean {
  const a = version.split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d < 0;
  }
  return false;
}
