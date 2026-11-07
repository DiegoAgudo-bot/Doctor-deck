import { describe, expect, it } from "vitest";
import { deviceLabel } from "./device-label";

describe("deviceLabel", () => {
  it("reconoce la app, el navegador y el sistema", () => {
    expect(deviceLabel("okhttp/4.12.0")).toBe("App de Android");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome en Android");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari en iPhone");
    expect(deviceLabel(null)).toBe("Dispositivo desconocido");
  });
});

describe("deviceLabel en inglés", () => {
  it("cambia la preposición y los genéricos", () => {
    expect(deviceLabel("okhttp/4", "en")).toBe("Android app");
    expect(
      deviceLabel("Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/130 Safari/537.36", "en"),
    ).toBe("Chrome on Windows");
  });
});
