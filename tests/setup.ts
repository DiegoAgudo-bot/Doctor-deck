import { beforeEach, vi } from "vitest";

// Los tests nunca llaman a la red: cualquier fetch sin mock falla.
beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Red deshabilitada en tests: inyecta un fetch falso o usa fixtures.");
  });
});
