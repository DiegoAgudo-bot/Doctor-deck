export type TaggerErrorCode =
  | "blocked" // Scryfall rechaza la petición (403/429): no se reintenta
  | "unavailable" // red caída o error 5xx
  | "format"; // el JSON no tiene la forma esperada

/** Único tipo de error que sale del adaptador de etiquetas de Scryfall. */
export class TaggerError extends Error {
  constructor(
    readonly code: TaggerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TaggerError";
  }
}
