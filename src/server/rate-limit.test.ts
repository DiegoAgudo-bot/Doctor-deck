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
