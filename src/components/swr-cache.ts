"use client";

import { storage } from "./api-client";

/**
 * Lo último que se cargó de algunas pantallas (mis mazos, la primera página de la colección…), en
 * el navegador: se enseña al momento mientras se pide lo nuevo ("stale-while-revalidate"). Se
 * borra al entrar o salir de la cuenta para no enseñar lo de otra persona.
 */
const PREFIX = "deck-doctor:swr:";

export function readCached<T>(key: string): T | null {
  return storage.get<{ v: T } | null>(PREFIX + key, null)?.v ?? null;
}

export function writeCached(key: string, value: unknown) {
  storage.set(PREFIX + key, { v: value });
}

/**
 * Llama a `onData` con lo guardado (si lo hay) y después con lo nuevo, que guarda. Si la petición
 * falla, lanza el error (lo guardado ya se ha enseñado).
 */
export async function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  onData: (value: T, fresh: boolean) => void,
): Promise<void> {
  const old = readCached<T>(key);
  if (old !== null) onData(old, false);
  const value = await fetcher();
  writeCached(key, value);
  onData(value, true);
}

/** Borra todo lo guardado y las preferencias locales (al entrar o salir de la cuenta). */
export function clearCached() {
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith(PREFIX) || k.startsWith("deck-doctor:pref:")) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* sin localStorage */
  }
}
