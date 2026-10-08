export type DeckSourceErrorCode =
  | "not_found" // el mazo no existe (o es privado y la web responde 404)
  | "blocked" // la web rechaza la petición (401/403/429): no se reintenta ni se intenta esquivar
  | "unavailable" // red caída o 5xx
  | "format"; // la respuesta no tiene la estructura esperada

/** Único tipo de error que sale de los adaptadores de mazos por link. */
export class DeckSourceError extends Error {
  constructor(
    readonly code: DeckSourceErrorCode,
    readonly source: string,
    message: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = "DeckSourceError";
  }
}
