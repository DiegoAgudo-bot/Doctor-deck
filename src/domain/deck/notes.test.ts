import { describe, expect, it } from "vitest";
import {
  CARD_NOTE_MAX,
  CARD_NOTES_MAX,
  cleanCardNote,
  cleanDescription,
  parseCardNotes,
  withCardNote,
} from "./notes";

describe("descripción y notas del mazo", () => {
  it("limpia la descripción y la nota (una línea, con tope)", () => {
    expect(cleanDescription("  Hola  \r\n\r\n\r\n\r\nmundo \n")).toBe("Hola\n\nmundo");
    expect(cleanCardNote(" Fetch \n de islas ")).toBe("Fetch de islas");
    expect(cleanCardNote("x".repeat(CARD_NOTE_MAX + 50))).toHaveLength(CARD_NOTE_MAX);
  });

  it("lee las notas guardadas e ignora lo que no vale", () => {
    expect(parseCardNotes('{"a":"nota","b":3,"c":""}')).toEqual({ a: "nota" });
    expect(parseCardNotes("[1]")).toEqual({});
    expect(parseCardNotes("no es json")).toEqual({});
  });

  it("pone, cambia y quita notas, con un máximo", () => {
    const one = withCardNote({}, "a", " win con ")!;
    expect(one).toEqual({ a: "win con" });
    expect(withCardNote(one, "a", "  ")).toEqual({});
    const full = Object.fromEntries(
      Array.from({ length: CARD_NOTES_MAX }, (_, i) => [`c${i}`, "n"]),
    );
    expect(withCardNote(full, "otra", "n")).toBeNull();
    expect(withCardNote(full, "c0", "cambiada")?.c0).toBe("cambiada");
  });
});
