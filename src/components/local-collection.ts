"use client";

import type { CollectionImportResponse } from "@/server/dto";
import { storage } from "./api-client";

/**
 * Colección de quien no tiene cuenta: se guarda solo en este navegador y se manda al analizar. Se
 * conserva también el CSV (si cabe) para poder guardarlo en la cuenta al registrarse.
 */
export interface LocalCollection {
  owned: [string, number][];
  summary: Omit<CollectionImportResponse, "owned" | "saved">;
  fileName: string;
  importedAt: string;
  csv: string | null;
}

const KEY = "deck-doctor:coleccion";
/** Aviso a la interfaz (lateral, inicio) de que la colección local ha cambiado. */
export const LOCAL_COLLECTION_EVENT = "dd:local-collection";
const MAX_CSV_CHARS = 2_000_000;

export const localCollection = {
  get(): LocalCollection | null {
    return storage.get<LocalCollection | null>(KEY, null);
  },
  /** false si el navegador no ha dejado guardarla. */
  set(c: LocalCollection): boolean {
    const csv = c.csv && c.csv.length <= MAX_CSV_CHARS ? c.csv : null;
    const ok = storage.set(KEY, { ...c, csv }) || storage.set(KEY, { ...c, csv: null });
    window.dispatchEvent(new Event(LOCAL_COLLECTION_EVENT));
    return ok;
  },
  clear() {
    storage.remove(KEY);
    window.dispatchEvent(new Event(LOCAL_COLLECTION_EVENT));
  },
};

/** Total de copias del CSV (como el resumen de una colección guardada en la cuenta). */
export const localCopies = (c: LocalCollection | null) => c?.summary.totalCards ?? 0;

/** Aviso a la interfaz de que han cambiado los mazos guardados (guardar, borrar). */
export const DECKS_EVENT = "dd:decks";
export const notifyDecksChanged = () => window.dispatchEvent(new Event(DECKS_EVENT));
