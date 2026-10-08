export type EdhrecErrorCode =
  | "not_found" // no existe página para ese comandante/tema
  | "blocked" // EDHREC rechaza la petición (403/429): no se reintenta ni se intenta esquivar
  | "unavailable" // red caída o error 5xx, sin copia en caché
  | "format" // el JSON no tiene la estructura esperada (EDHREC ha cambiado algo)
  | "invalid_query";

/** Único tipo de error que sale del adaptador de EDHREC. */
export class EdhrecError extends Error {
  constructor(
    readonly code: EdhrecErrorCode,
    message: string,
    readonly url?: string,
  ) {
    super(message);
    this.name = "EdhrecError";
  }
}
