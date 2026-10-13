/** 12,50 € (como la web). */
export const euros = (x: number | null | undefined) =>
  x == null ? "—" : `${x.toFixed(2).replace(".", ",")} €`;

/** 1.234 */
export const thousands = (n: number) => n.toLocaleString("es-ES");

/** "hace 3 h", "hace 2 d"… */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 30 * 86_400) return `hace ${Math.floor(s / 86_400)} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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
