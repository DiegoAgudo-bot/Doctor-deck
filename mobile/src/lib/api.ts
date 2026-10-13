import { authClient } from "./auth";
import { API_URL } from "./config";

/** Error de la API con el mensaje en español que manda el servidor (`{error: {code, message}}`). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Petición a la API con la sesión de la app. `body` se manda como JSON (o tal cual si es texto). */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; raw?: boolean } = {},
): Promise<T> {
  const cookie = await authClient.getCookie();
  const isText = typeof options.body === "string" && options.raw;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(options.body === undefined
          ? {}
          : { "content-type": isText ? "text/plain; charset=utf-8" : "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: isText ? (options.body as string) : JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError("Sin conexión con Doctor Deck. Comprueba internet.", 0, "network");
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as
    (T & { error?: { code: string; message: string } }) | null;
  if (!res.ok) {
    throw new ApiError(
      data?.error?.message ?? `Error ${res.status}`,
      res.status,
      data?.error?.code ?? "error",
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
