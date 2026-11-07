import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "./errors";

describe("apiErrorMessage", () => {
  it("deja el español tal cual y traduce por código al inglés", () => {
    expect(apiErrorMessage("trade_closed", "Esta propuesta ya está cerrada.", "es")).toBe(
      "Esta propuesta ya está cerrada.",
    );
    expect(apiErrorMessage("trade_closed", "Esta propuesta ya está cerrada.", "en")).toBe(
      "This proposal is already closed.",
    );
  });
  it("con un código desconocido no enseña el español", () => {
    expect(apiErrorMessage("raro", "Algo raro", "en")).toBe("Something went wrong. Try again.");
  });
});
