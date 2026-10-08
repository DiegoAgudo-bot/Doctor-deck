import { describe, expect, it } from "vitest";

describe("entorno de tests", () => {
  it("bloquea fetch", () => {
    expect(() => fetch("https://example.com")).toThrow(/Red deshabilitada/);
  });
});
