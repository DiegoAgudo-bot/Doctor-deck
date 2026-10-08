import type { ApiErrorBody } from "@/server/dto";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Llama a la API JSON y lanza ApiError con el mensaje del servidor si falla. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // Contra el origin y no la ruta relativa: si la página se abrió con credenciales en la URL
    // (https://usuario:clave@…), fetch rechaza las URLs relativas que las heredan.
    res = await fetch(new URL(path, window.location.origin), init);
  } catch {
    throw new ApiError("network", "No se pudo contactar con el servidor", 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    if (err?.code === "unauthorized") {
      const here = window.location.pathname + window.location.search;
      // Recarga completa a propósito: sesión caducada, se descarta el estado del cliente.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(here)}`);
    }
    throw new ApiError(err?.code ?? "http", err?.message ?? `Error HTTP ${res.status}`, res.status);
  }
  return body as T;
}

/** localStorage tolerante a fallos (modo privado, cuotas…). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignorado */
    }
  },
};
