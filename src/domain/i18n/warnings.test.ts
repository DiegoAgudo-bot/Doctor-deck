import { describe, expect, it } from "vitest";
import { localizeWarning } from "./warnings";

describe("localizeWarning", () => {
  it("traduce los avisos conocidos y deja el español", () => {
    const es =
      "No se pudieron actualizar las recomendaciones (no responde). Se usan datos guardados del 2026-11-01.";
    expect(localizeWarning(es, "es")).toBe(es);
    expect(localizeWarning(es, "en")).toBe(
      "Couldn't refresh the community data; using data saved on 2026-11-01.",
    );
    expect(localizeWarning("Hay más combos de los que se muestran.", "en")).toBe(
      "There are more combos than shown.",
    );
    expect(localizeWarning(null, "en")).toBeNull();
  });
});
