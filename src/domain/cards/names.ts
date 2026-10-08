/**
 * Clave de búsqueda para nombres de carta: insensible a mayúsculas, tildes,
 * tipos de comillas y espaciado alrededor de `//`.
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s*\/\/?\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Primera cara de un nombre `A // B` (o el nombre entero si no tiene `//`). */
export function frontFace(name: string): string {
  const idx = name.indexOf("//");
  return (idx === -1 ? name : name.slice(0, idx)).trim();
}
