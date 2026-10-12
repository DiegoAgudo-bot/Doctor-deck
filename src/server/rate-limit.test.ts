import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit";

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
