export interface CachedResponse {
  body: string;
  fetchedAt: Date;
}

/** Caché clave → cuerpo de respuesta. El TTL lo decide quien la usa (fetchedAt). */
export interface ResponseCache {
  get(key: string): Promise<CachedResponse | null>;
  set(key: string, value: CachedResponse): Promise<void>;
}
