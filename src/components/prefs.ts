"use client";

import type { PrefKey } from "@/domain/prefs/prefs";
import { api, storage } from "./api-client";

/**
 * Preferencias de la interfaz (filtros, orden y vista de cada página). Se guardan en el navegador
 * (para tenerlas al instante) y, con cuenta, en el servidor (`/api/me/prefs`), para que sigan en
 * otro navegador o en la app.
 */
const localKey = (key: PrefKey) => `deck-doctor:pref:${key}`;

let serverPrefs: Promise<Partial<Record<PrefKey, unknown>>> | null = null;
/** Una sola petición por carga de página, compartida por todas las que lo pidan. */
function loadServerPrefs() {
  serverPrefs ??= api<{ prefs: Partial<Record<PrefKey, unknown>> }>("/api/me/prefs", undefined, {
    silent: true,
  })
    .then((r) => r.prefs)
    .catch(() => {
      serverPrefs = null;
      return {};
    });
  return serverPrefs;
}

/**
 * Recupera una preferencia: primero la del navegador (síncrona, llama a `apply` si la hay); con
 * cuenta, después la del servidor, y si es distinta la aplica también. `onReady` se llama cuando ya
 * se puede pedir y guardar: enseguida si había una en el navegador; si no (otro navegador), tras
 * preguntar al servidor, para no pisar la guardada con la de por defecto. `parse` valida lo leído
 * (null = no sirve). Devuelve la función para dejar de escuchar.
 */
export function restorePref<T>(
  key: PrefKey,
  parse: (raw: unknown) => T | null,
  loggedIn: boolean,
  apply: (value: T) => void,
  onReady: () => void,
): () => void {
  let alive = true;
  const raw = storage.get<unknown>(localKey(key), null);
  const local = raw === null ? null : parse(raw);
  if (local !== null) apply(local);
  if (local !== null || !loggedIn) onReady();
  if (loggedIn) {
    void loadServerPrefs().then((prefs) => {
      if (!alive) return;
      const remote = prefs[key] === undefined ? null : parse(prefs[key]);
      if (remote !== null && JSON.stringify(prefs[key]) !== JSON.stringify(raw)) {
        storage.set(localKey(key), prefs[key]);
        apply(remote);
      }
      if (local === null) onReady();
    });
  }
  return () => {
    alive = false;
  };
}

const timers = new Map<PrefKey, ReturnType<typeof setTimeout>>();

/** Guarda una preferencia: en el navegador al momento y, con cuenta, en el servidor (agrupado). */
export function savePref(key: PrefKey, value: Record<string, unknown>, loggedIn: boolean) {
  const before = JSON.stringify(storage.get<unknown>(localKey(key), null));
  if (before === JSON.stringify(value)) {
    // Ya está así (p. ej. recién llegada del servidor): lo que hubiera pendiente sobra.
    clearTimeout(timers.get(key));
    return;
  }
  storage.set(localKey(key), value);
  if (!loggedIn) return;
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      serverPrefs = null;
      void api(
        `/api/me/prefs/${key}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
        { silent: true },
      ).catch(() => {
        /* se queda en el navegador; se reintenta en el próximo cambio */
      });
    }, 800),
  );
}
