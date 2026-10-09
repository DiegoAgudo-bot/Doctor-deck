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

/**
 * Llama a la API JSON y lanza ApiError con el mensaje del servidor si falla. Con un 401 lleva a la
 * página de entrar, salvo con `silent` (peticiones de fondo, p. ej. la lista del lateral).
 */
export async function api<T>(
  path: string,
  init?: RequestInit,
  { silent = false }: { silent?: boolean } = {},
): Promise<T> {
  let res: Response;
  try {
    // Contra el origin y no la ruta relativa: si la página se abrió con credenciales en la URL
    // (https://usuario:clave@…), fetch rechaza las URLs relativas que las heredan.
    res = await fetch(new URL(path, window.location.origin), init);
  } catch {
    throw new ApiError("network", "No se pudo contactar con el servidor", 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 401 && !silent) {
    // Sesión caducada o inexistente: a la página de entrar, volviendo luego aquí. Recarga completa a
    // propósito: se descarta el estado del cliente.
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(new URL(`/entrar?next=${next}`, window.location.origin));
  }
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
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
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignorado */
    }
  },
  /** false si no se ha podido guardar (cuota llena, modo privado…). */
  set(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
