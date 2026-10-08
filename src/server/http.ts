import { z } from "zod";
import { DeckSourceError } from "@/adapters/deck-sources/errors";
import { EdhrecError } from "@/adapters/edhrec/errors";
import { UnsupportedDeckInputError } from "@/application/load-deck";
import { DeckWithoutCommanderError } from "@/application/save-deck";
import { EmptyCatalogError } from "@/application/import-collection";
import { CsvParseError } from "@/domain/collection/csv";
import { ManaboxFormatError } from "@/domain/collection/manabox";
import type { ApiErrorBody } from "./dto";

const EDHREC_STATUS: Record<EdhrecError["code"], number> = {
  not_found: 404,
  blocked: 503,
  unavailable: 503,
  format: 502,
  invalid_query: 400,
};

/** Traduce errores conocidos a respuestas JSON con un mensaje para el usuario. */
export function errorResponse(err: unknown): Response {
  const body = (code: string, message: string): ApiErrorBody => ({ error: { code, message } });
  if (err instanceof EdhrecError) {
    return Response.json(body(`edhrec_${err.code}`, err.message), {
      status: EDHREC_STATUS[err.code],
    });
  }
  if (err instanceof DeckSourceError) {
    const status = { not_found: 404, blocked: 503, unavailable: 503, format: 502 }[err.code];
    return Response.json(body(`${err.source}_${err.code}`, err.message), { status });
  }
  if (err instanceof DeckWithoutCommanderError) {
    return Response.json(body("no_commander", err.message), { status: 400 });
  }
  if (err instanceof UnsupportedDeckInputError) {
    return Response.json(body("unsupported_input", err.message), { status: 400 });
  }
  if (err instanceof EmptyCatalogError)
    return Response.json(body("empty_catalog", err.message), { status: 409 });
  if (err instanceof ManaboxFormatError || err instanceof CsvParseError) {
    return Response.json(body("invalid_csv", err.message), { status: 400 });
  }
  if (err instanceof z.ZodError) {
    return Response.json(body("invalid_request", z.prettifyError(err)), { status: 400 });
  }
  if (err instanceof Error && /comandantes|combinación/.test(err.message)) {
    return Response.json(body("invalid_commanders", err.message), { status: 400 });
  }
  console.error(err);
  return Response.json(body("internal", "Error inesperado en el servidor"), { status: 500 });
}
