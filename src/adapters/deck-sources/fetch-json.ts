import { HttpError, NetworkError, type HttpClient } from "../http/http-client";
import { DeckSourceError } from "./errors";

const LABEL: Record<string, string> = { archidekt: "Archidekt", moxfield: "Moxfield" };

/** GET JSON traduciendo cualquier fallo a DeckSourceError con un mensaje para el usuario. */
export async function fetchDeckJson(
  http: HttpClient,
  url: string,
  source: string,
): Promise<unknown> {
  const name = LABEL[source] ?? source;
  let body: string;
  try {
    body = await (await http.get(url)).text();
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 404) {
        throw new DeckSourceError(
          "not_found",
          source,
          `${name} no encuentra ese mazo. ¿Es público?`,
          url,
        );
      }
      if (err.status === 401 || err.status === 403 || err.status === 429) {
        throw new DeckSourceError(
          "blocked",
          source,
          `${name} ha rechazado la petición (HTTP ${err.status}). Comprueba que el mazo es público o exporta la lista como texto desde ${name} y pégala aquí.`,
          url,
        );
      }
      throw new DeckSourceError(
        "unavailable",
        source,
        `${name} ha respondido con un error (HTTP ${err.status}).`,
        url,
      );
    }
    if (err instanceof NetworkError) {
      throw new DeckSourceError(
        "unavailable",
        source,
        `${err.message}. Puedes exportar la lista como texto desde ${name} y pegarla aquí.`,
        url,
      );
    }
    throw err;
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new DeckSourceError(
      "format",
      source,
      `${name} no ha devuelto JSON válido. Exporta la lista como texto y pégala aquí.`,
      url,
    );
  }
}
