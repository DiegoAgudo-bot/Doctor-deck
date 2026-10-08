import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DeckSourceError } from "@/adapters/deck-sources/errors";
import { EdhrecError } from "@/adapters/edhrec/errors";
import { UnsupportedDeckInputError } from "@/application/load-deck";
import { EmptyCatalogError } from "@/application/import-collection";
import { ManaboxFormatError } from "@/domain/collection/manabox";
import { errorResponse } from "./http";

const body = async (r: Response) =>
  ((await r.json()) as { error: { code: string; message: string } }).error;

describe("errorResponse", () => {
  it.each([
    [new EdhrecError("not_found", "x"), 404, "edhrec_not_found"],
    [new EdhrecError("blocked", "x"), 503, "edhrec_blocked"],
    [new EdhrecError("format", "x"), 502, "edhrec_format"],
    [new EmptyCatalogError(), 409, "empty_catalog"],
    [new DeckSourceError("blocked", "moxfield", "x"), 503, "moxfield_blocked"],
    [new DeckSourceError("not_found", "archidekt", "x"), 404, "archidekt_not_found"],
    [new UnsupportedDeckInputError(), 400, "unsupported_input"],
    [new ManaboxFormatError("x"), 400, "invalid_csv"],
    [z.string().safeParse(1).error, 400, "invalid_request"],
    [new Error("Esa combinación de comandantes no es válida"), 400, "invalid_commanders"],
  ])("%s → %i", async (err, status, code) => {
    const r = errorResponse(err);
    expect(r.status).toBe(status);
    expect((await body(r)).code).toBe(code);
  });

  it("los errores desconocidos no filtran detalles internos", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = errorResponse(new Error("SQLITE_BUSY: ruta /secreta"));
    expect(r.status).toBe(500);
    expect((await body(r)).message).toBe("Error inesperado en el servidor");
    spy.mockRestore();
  });
});
