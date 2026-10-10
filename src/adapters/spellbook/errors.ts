export type ComboSourceErrorCode =
  | "blocked" // Spellbook rechaza la petición (403/429): no se reintenta ni se intenta esquivar
  | "unavailable" // red caída o error 5xx, sin copia en caché
  | "format"; // el JSON no tiene la estructura esperada (Spellbook ha cambiado algo)

/** Único tipo de error que sale del adaptador de Commander Spellbook. */
export class ComboSourceError extends Error {
  constructor(
    readonly code: ComboSourceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ComboSourceError";
  }
}
