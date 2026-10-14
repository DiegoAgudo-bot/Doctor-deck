const BASE = "https://doctordeck.invalid";

/**
 * Una ruta de la propia web para redirigir tras entrar o desde la app (`?next=`), o null si no lo
 * es. No basta con mirar que empiece por `/`: `/\otro.com` o `/\t/otro.com` acaban en otro dominio
 * (los navegadores tratan `\` como `/` y quitan tabuladores y saltos de línea).
 */
export function internalPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
