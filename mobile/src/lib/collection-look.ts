/** Orden y vista de la colección guardados con la cuenta (`/api/me/prefs`), como en la web. */

export type Pref = Record<string, unknown>;

/** Lo que la app comparte con la web de la colección: orden, dirección y vista. */
export interface CollectionLook {
  sort: string;
  desc: boolean;
  grid: boolean;
}

/** Dirección natural de cada orden (la de la web cuando `dir` es null). */
export const naturalDesc = (sort: string) => sort !== "nombre" && sort !== "coste";

/** Lee la preferencia de la web (`GET /api/me/prefs`): solo lo que entiende la app. */
export function parseCollectionLook(
  pref: Pref | undefined,
  sorts: readonly string[],
): Partial<CollectionLook> {
  if (!pref) return {};
  const out: Partial<CollectionLook> = {};
  const sort = typeof pref.sort === "string" ? pref.sort : undefined;
  if (sort && sorts.includes(sort)) {
    out.sort = sort;
    out.desc = pref.dir === "asc" ? false : pref.dir === "desc" ? true : naturalDesc(sort);
  }
  if (pref.view === "cuadricula") out.grid = true;
  else if (pref.view === "tabla") out.grid = false;
  return out;
}

/** La preferencia de la web con lo de la app encima (sin tocar los filtros que guarde la web). */
export function withCollectionLook(pref: Pref | undefined, look: CollectionLook): Pref {
  return {
    ...pref,
    sort: look.sort,
    dir: look.desc === naturalDesc(look.sort) ? null : look.desc ? "desc" : "asc",
    view: look.grid ? "cuadricula" : "tabla",
  };
}
