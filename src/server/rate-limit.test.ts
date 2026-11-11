import { describe, expect, it } from "vitest";
import { clientIp, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("deja max por ventana y por clave", () => {
    let now = 0;
    const rl = new RateLimiter(2, 1000, () => now);
    expect([rl.allow("a"), rl.allow("a"), rl.allow("a"), rl.allow("b")]).toEqual([
      true,
      true,
      false,
      true,
    ]);
    now = 1000;
    expect(rl.allow("a")).toBe(true);
  });

  it("con muchas claves, quien ya gastó su cupo en esta ventana no lo recupera", () => {
    let now = 0;
    const rl = new RateLimiter(1, 1000, () => now);
    for (let i = 0; i < 10_001; i++) rl.allow(`viejo${i}`);
    now = 1500;
    expect(rl.allow("abusón")).toBe(true);
    expect(rl.allow("abusón")).toBe(false);
    // Otra clave nueva dispara la limpieza: se van las ventanas cerradas, no la de «abusón».
    expect(rl.allow("otro")).toBe(true);
    expect(rl.allow("abusón")).toBe(false);
  });
});

describe("clientIp", () => {
  it("usa el último valor de X-Forwarded-For (el que pone el proxy)", () => {
    const req = (xff?: string) =>
      new Request("http://x/", { headers: xff ? { "x-forwarded-for": xff } : {} });
    expect(clientIp(req("1.1.1.1, 2.2.2.2"))).toBe("2.2.2.2");
    expect(clientIp(req("3.3.3.3"))).toBe("3.3.3.3");
    expect(clientIp(req())).toBe("?");
  });
});
