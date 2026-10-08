import { describe, expect, it } from "vitest";
import {
  appPassword,
  checkPassword,
  isPublicPath,
  isValidSession,
  safeNextPath,
  sessionToken,
} from "./auth";

describe("auth", () => {
  it("sin APP_PASSWORD no hay contraseña", () => {
    expect(appPassword({})).toBeNull();
    expect(appPassword({ APP_PASSWORD: "" })).toBeNull();
    expect(appPassword({ APP_PASSWORD: "x" })).toBe("x");
  });

  it("valida la cookie de sesión de la contraseña actual", () => {
    expect(isValidSession(sessionToken("clave"), "clave")).toBe(true);
    expect(isValidSession(sessionToken("antigua"), "clave")).toBe(false);
    expect(isValidSession("basura", "clave")).toBe(false);
    expect(isValidSession(undefined, "clave")).toBe(false);
  });

  it("comprueba la contraseña", () => {
    expect(checkPassword("clave", "clave")).toBe(true);
    expect(checkPassword("Clave", "clave")).toBe(false);
    expect(checkPassword("", "clave")).toBe(false);
  });

  it("solo el login es público", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/login")).toBe(true);
    expect(isPublicPath("/api/status")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });

  it("solo redirige a rutas internas", () => {
    expect(safeNextPath("/mazo?id=3")).toBe("/mazo?id=3");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
  });
});
