import { z } from "zod";
import { DeckNotFoundError } from "@/adapters/db/deck-repository";
import { DeckSourceError } from "@/adapters/deck-sources/errors";
import { EdhrecError } from "@/adapters/edhrec/errors";
import { UnsupportedDeckInputError } from "@/application/load-deck";
import { InvalidCommanderError } from "@/application/new-deck";
import { CannotFollowSelfError, ProfileNotFoundError, UsernameError } from "@/application/social";
import { DeckWithoutCommanderError } from "@/application/save-deck";
import { EmptyCatalogError } from "@/application/import-collection";
import { CsvParseError } from "@/domain/collection/csv";
import { ManaboxFormatError } from "@/domain/collection/manabox";
import type { ApiErrorBody } from "./dto";
import { UnauthorizedError } from "./session";

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
  if (err instanceof UnauthorizedError) {
    return Response.json(body("unauthorized", err.message), { status: 401 });
  }
  if (err instanceof InvalidCommanderError) {
    return Response.json(body("invalid_commander", err.message), { status: 400 });
  }
  if (err instanceof ProfileNotFoundError) {
    return Response.json(body("user_not_found", err.message), { status: 404 });
  }
  if (err instanceof UsernameError) {
    return Response.json(body(`username_${err.problem}`, err.message), {
      status: err.problem === "taken" ? 409 : 400,
    });
  }
  if (err instanceof CannotFollowSelfError) {
    return Response.json(body("follow_self", err.message), { status: 400 });
  }
  if (err instanceof DeckNotFoundError) {
    return Response.json(body("deck_not_found", err.message), { status: 404 });
  }
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
