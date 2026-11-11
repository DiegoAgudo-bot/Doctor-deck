import { authClient } from "./auth";
import { apiErrorMessage } from "@/domain/i18n/errors";
import { API_URL } from "./config";
import { isEn, locale } from "./i18n";

/**
 * Error de la API (`{error: {code, message}}`). El servidor manda el mensaje en español; en
 * inglés se enseña el de `apiErrorMessage` por su código.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Tope de una petición: lo normal, y subir un CSV entero (hasta 21 MB con mala cobertura). */
export const API_TIMEOUT_MS = 45_000;
export const API_UPLOAD_TIMEOUT_MS = 180_000;

let lastSessionCheck = 0;

/**
 * La API ha dicho 401 con la sesión que tenemos: se le pide a Better Auth que la compruebe. Si ha
 * caducado, `useSession` se queda sin usuario y el layout lleva a «Entrar» (en vez de dejar cada
 * pantalla con su error). Como mucho una comprobación cada 10 s.
 */
function recheckSession() {
  const now = Date.now();
  if (now - lastSessionCheck < 10_000) return;
  lastSessionCheck = now;
  authClient.$store.notify("$sessionSignal");
}

/**
 * Petición a la API con la sesión de la app. `body` se manda como JSON (o tal cual si es texto).
 * Se corta sola a los `timeoutMs` (con mala cobertura, `fetch` puede no acabar nunca).
 */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; raw?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const cookie = await authClient.getCookie();
  const isText = typeof options.body === "string" && options.raw;
  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(),
    options.timeoutMs ?? (isText ? API_UPLOAD_TIMEOUT_MS : API_TIMEOUT_MS),
  );
  let res: Response;
  type Body = (T & { error?: { code: string; message: string } }) | null;
  let data = null as Body;
  try {
    res = await fetch(`${API_URL}${path}`, {
      signal: abort.signal,
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      // La sesión va en la cabecera; sin esto, el almacén de cookies de Android pone las suyas
      // (viejas o del WebView) encima y el servidor responde 401.
      credentials: "omit",
      headers: {
        ...(cookie ? { cookie } : {}),
        // Textos del servidor (motivos, avisos…) en el idioma del móvil.
        "x-locale": locale,
        ...(options.body === undefined
          ? {}
          : { "content-type": isText ? "text/plain; charset=utf-8" : "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: isText ? (options.body as string) : JSON.stringify(options.body) }),
    });
    // El cuerpo también cuenta para el tope: la respuesta puede quedarse a medias.
    if (res.status !== 204) data = (await res.json().catch(() => null)) as Body;
  } catch {
    if (abort.signal.aborted) {
      throw new ApiError(
        isEn
          ? "Doctor Deck is taking too long to answer. Check your connection and try again."
          : "Doctor Deck tarda demasiado en responder. Comprueba la conexión y vuelve a probar.",
        0,
        "timeout",
      );
    }
    throw new ApiError(
      isEn
        ? "Couldn't reach Doctor Deck. Check your internet connection."
        : "Sin conexión con Doctor Deck. Comprueba internet.",
      0,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  if (res.status === 401 && cookie) recheckSession();
  if (!res.ok) {
    const code = data?.error?.code ?? "error";
    throw new ApiError(
      apiErrorMessage(code, data?.error?.message ?? `Error ${res.status}`, locale),
      res.status,
      code,
    );
  }
  return data as T;
}

/** Las imágenes vienen como `/img/…` (servidas por nuestro servidor, no por Scryfall). */
export const imageUri = (path: string | null | undefined) =>
  !path ? null : path.startsWith("http") ? path : `${API_URL}${path}`;

/** Imagen pequeña (146 px) de Scryfall para miniaturas: misma ruta con `/small/`. */
export const smallImageUri = (path: string | null | undefined) =>
  imageUri(path?.replace("/normal/", "/small/") ?? null);

/** Arte recortado de la carta (`art_crop`), para las portadas de los mazos. */
export const artUri = (path: string | null | undefined) =>
  imageUri(path?.replace("/normal/", "/art_crop/") ?? null);
