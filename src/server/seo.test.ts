import { describe, expect, it } from "vitest";
import { metaDescription } from "./seo";

describe("metaDescription", () => {
  it("une las partes en una línea", () => {
    expect(metaDescription(["Sol Ring:", "{T}: Add {C}{C}.\nOtra línea", null])).toBe(
      "Sol Ring: {T}: Add {C}{C}. Otra línea",
    );
  });

  it("corta por una palabra y termina con puntos suspensivos", () => {
    const out = metaDescription(["uno dos tres cuatro cinco seis siete"], 20);
    expect(out).toBe("uno dos tres cuatro…");
    expect(out.length).toBeLessThanOrEqual(20);
  });
});
