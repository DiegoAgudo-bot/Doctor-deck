"use client";

import type { PrefKey } from "@/domain/prefs/prefs";
import { api, storage } from "./api-client";

/**
 * Preferencias de la interfaz (filtros, orden y vista de cada página). Se guardan en el navegador
 * (para tenerlas al instante) y, con cuenta, en el servidor (`/api/me/prefs`), para que sigan en
 * otro navegador o en la app. Lo que aún no ha llegado al servidor queda marcado como pendiente y
 * se manda al salir de la página o la próxima vez.
 */
const localKey = (key: PrefKey) => `deck-doctor:pref:${key}`;
const dirtyKey = (key: PrefKey) => `deck-doctor:pref-dirty:${key}`;
const url = (key: PrefKey) => `/api/me/prefs/${key}`;

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

const timers = new Map<PrefKey, ReturnType<typeof setTimeout>>();

/** Manda al servidor lo que hay en el navegador para esa clave (si sigue pendiente). */
function push(key: PrefKey, keepalive = false) {
  clearTimeout(timers.get(key));
  timers.delete(key);
  const value = storage.get<unknown>(localKey(key), null);
  if (value === null || !storage.get(dirtyKey(key), false)) return;
  serverPrefs = null;
  void fetch(new URL(url(key), window.location.origin), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
    keepalive,
  })
    .then((r) => {
      // Solo se desmarca si no ha cambiado mientras tanto.
      if (r.ok && JSON.stringify(storage.get(localKey(key), null)) === JSON.stringify(value)) {
        storage.remove(dirtyKey(key));
      }
    })
    .catch(() => {
      /* sigue pendiente: se reintenta en el próximo cambio o al volver */
    });
}

let flushing = false;
/** Al salir de la página (o pasar a segundo plano en el móvil), manda lo pendiente. */
function flushOnLeave() {
  if (flushing || typeof window === "undefined") return;
  flushing = true;
  const flush = () => {
    for (const key of [...timers.keys()]) push(key, true);
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/**
 * Recupera una preferencia: primero la del navegador (síncrona, llama a `apply` si la hay); con
 * cuenta, después la del servidor, y si es distinta la aplica también (salvo que la del navegador
 * esté pendiente de subir: entonces se sube). `onReady` se llama cuando ya se puede pedir y
 * guardar: enseguida si había una en el navegador; si no (otro navegador), tras preguntar al
 * servidor, para no pisar la guardada con la de por defecto. `parse` valida lo leído (null = no
 * sirve). Devuelve la función para dejar de escuchar.
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
    if (local !== null && storage.get(dirtyKey(key), false)) {
      push(key);
      return () => {
        alive = false;
      };
    }
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

/** Guarda una preferencia: en el navegador al momento y, con cuenta, en el servidor (agrupado). */
export function savePref(key: PrefKey, value: Record<string, unknown>, loggedIn: boolean) {
  const before = JSON.stringify(storage.get<unknown>(localKey(key), null));
  if (before === JSON.stringify(value)) return;
  storage.set(localKey(key), value);
  if (!loggedIn) return;
  storage.set(dirtyKey(key), true);
  flushOnLeave();
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => push(key), 800),
  );
}
