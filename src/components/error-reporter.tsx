"use client";

import { useEffect } from "react";

/** Como mucho, errores que manda una misma carga de página. */
const MAX_PER_PAGE = 10;
let sent = 0;
const seen = new Set<string>();

/** Errores que no son nuestros (extensiones del navegador) o que no aportan nada. */
const IGNORED = [/ResizeObserver loop/, /^Script error\.?$/, /extension:\/\//];

/** Manda un error de JavaScript del navegador al registro de /admin/errors (sin datos personales). */
export function reportClientError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;
  if (IGNORED.some((r) => r.test(message) || (stack !== null && r.test(stack)))) return;
  if (sent >= MAX_PER_PAGE || seen.has(message)) return;
  sent += 1;
  seen.add(message);
  try {
    void fetch(new URL("/api/errors", window.location.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* sin red: se pierde */
  }
}

/** Escucha los errores sin capturar y las promesas rechazadas sin `catch`. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
