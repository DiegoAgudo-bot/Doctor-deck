"use client";

import { useEffect } from "react";

/** Nombre de la caché de `public/sw.js` (el contador de vidas sin conexión). */
const PLAY_CACHE = "dd-play-v1";

/** Registra `public/sw.js` (solo en producción: en desarrollo los archivos cambian sin hash). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin service worker: todo sigue funcionando con conexión */
    });
  }, []);
  return null;
}

/** Al salir de la cuenta: la copia guardada de /play lleva la cabecera con tu nombre. */
export function clearOfflineCache() {
  if (typeof caches === "undefined") return;
  void caches.delete(PLAY_CACHE).catch(() => undefined);
}
