/** Buscador global de la pestaña Buscar: además de cartas, mis mazos y gente (como en la web). */

/** Sin tildes ni mayúsculas, para comparar lo escrito con nombres. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mis mazos cuyo nombre o comandante contiene todas las palabras escritas (como mucho `max`). */
export function matchDecks<D extends { name: string; commanderNames: readonly string[] }>(
  decks: readonly D[],
  query: string,
  max = 3,
): D[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return decks
    .filter((d) => {
      const hay = fold([d.name, ...d.commanderNames].join(" "));
      return words.every((w) => hay.includes(w));
    })
    .slice(0, max);
}
