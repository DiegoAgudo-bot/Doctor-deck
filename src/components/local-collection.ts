"use client";

import type { CollectionImportResponse } from "@/server/dto";
import { storage } from "./api-client";

/**
 * Colección de quien no tiene cuenta: vive solo en este navegador y se manda al analizar. Tiene
 * dos partes, como la de la cuenta: lo importado del CSV (se guarda también el CSV, si cabe, para
 * poder pasarlo a la cuenta al registrarse) y las cartas añadidas sueltas.
 */
export interface LocalImport {
  owned: [string, number][];
  summary: Omit<CollectionImportResponse, "owned" | "saved">;
  fileName: string;
  importedAt: string;
  csv: string | null;
}

export interface LocalAdded {
  id: string;
  oracleId: string;
  name: string;
  quantity: number;
  foil: boolean;
  addedAt: string;
}

export interface LocalCollection {
  import: LocalImport | null;
  added: LocalAdded[];
}

const KEY = "deck-doctor:coleccion";
/** Aviso a la interfaz (lateral, inicio, colección) de que la colección local ha cambiado. */
export const LOCAL_COLLECTION_EVENT = "dd:local-collection";
const MAX_CSV_CHARS = 2_000_000;

/** Versiones anteriores guardaban solo lo importado, en la raíz. */
function read(): LocalCollection {
  const raw = storage.get<unknown>(KEY, null);
  if (!raw || typeof raw !== "object") return { import: null, added: [] };
  if ("owned" in raw) return { import: raw as LocalImport, added: [] };
  const c = raw as Partial<LocalCollection>;
  return { import: c.import ?? null, added: Array.isArray(c.added) ? c.added : [] };
}

function write(c: LocalCollection): boolean {
  const ok =
    c.import === null && c.added.length === 0 ? (storage.remove(KEY), true) : storage.set(KEY, c);
  window.dispatchEvent(new Event(LOCAL_COLLECTION_EVENT));
  return ok;
}

export const localCollection = {
  /** null si no hay nada (ni CSV ni cartas sueltas). */
  get(): LocalCollection | null {
    const c = read();
    return c.import === null && c.added.length === 0 ? null : c;
  },
  /** Reemplaza lo importado (las sueltas se quedan). false si el navegador no ha dejado guardar. */
  setImport(i: LocalImport): boolean {
    const c = read();
    const csv = i.csv && i.csv.length <= MAX_CSV_CHARS ? i.csv : null;
    return write({ ...c, import: { ...i, csv } }) || write({ ...c, import: { ...i, csv: null } });
  },
  addCards(cards: Omit<LocalAdded, "id" | "addedAt">[]): boolean {
    const c = read();
    const at = new Date().toISOString();
    const added = cards.map((x, i) => ({ ...x, id: `${Date.now()}-${i}`, addedAt: at }));
    return write({ ...c, added: [...added, ...c.added] });
  },
  removeAdded(id: string) {
    const c = read();
    write({ ...c, added: c.added.filter((a) => a.id !== id) });
  },
  /** Olvida lo importado del CSV (las sueltas se quedan). */
  clearImport() {
    write({ ...read(), import: null });
  },
  clear() {
    write({ import: null, added: [] });
  },
};

/** Copias por carta (CSV + sueltas), como pares [oracleId, copias] para la API. */
export function ownedPairs(c: LocalCollection | null): [string, number][] {
  const owned = new Map<string, number>(c?.import?.owned ?? []);
  for (const a of c?.added ?? []) owned.set(a.oracleId, (owned.get(a.oracleId) ?? 0) + a.quantity);
  return [...owned];
}

/** Total de copias identificadas (CSV emparejado + sueltas), como en una cuenta. */
export const localCopies = (c: LocalCollection | null) =>
  ownedPairs(c).reduce((n, [, q]) => n + q, 0);

/** Aviso a la interfaz de que han cambiado los mazos guardados (guardar, borrar). */
export const DECKS_EVENT = "dd:decks";
export const notifyDecksChanged = () => window.dispatchEvent(new Event(DECKS_EVENT));

/** Aviso de que ha cambiado la colección de la cuenta (importar, añadir, quitar). */
export const COLLECTION_EVENT = "dd:collection";
export const notifyCollectionChanged = () => window.dispatchEvent(new Event(COLLECTION_EVENT));
