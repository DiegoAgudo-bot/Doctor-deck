import { describe, expect, it } from "vitest";
import { cleanReport, errorFingerprint } from "./report";

describe("registro de errores", () => {
  it("agrupa el mismo error aunque cambien números e ids", () => {
    const a = errorFingerprint({
      source: "client",
      message: "No existe la línea 12",
      path: "/decks/0b9a6f8e-1234-4abc-9def-0123456789ab",
    });
    const b = errorFingerprint({
      source: "client",
      message: "No existe la línea 7",
      path: "/decks/11111111-2222-4333-8444-555555555555",
    });
    expect(a).toBe(b);
    expect(errorFingerprint({ source: "server", message: "No existe la línea 7" })).not.toBe(b);
  });

  it("recorta los campos y quita la query de la ruta", () => {
    const r = cleanReport({
      source: "client",
      message: "x".repeat(900),
      path: "/cards?q=secreto#a",
      stack: null,
    });
    expect(r.message).toHaveLength(500);
    expect(r.path).toBe("/cards");
  });
});
