import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("aplica valores por defecto", () => {
    const env = loadEnv({ DATABASE_URL: "file:./x.db", HTTP_USER_AGENT: "DeckDoctor/test" });
    expect(env.EDHREC_CACHE_TTL_HOURS).toBe(24);
    expect(env.SCRYFALL_MIN_INTERVAL_MS).toBe(100);
  });

  it("rechaza un intervalo de Scryfall menor de 100 ms", () => {
    expect(() =>
      loadEnv({ DATABASE_URL: "f", HTTP_USER_AGENT: "u", SCRYFALL_MIN_INTERVAL_MS: "50" }),
    ).toThrow(/inválida/);
  });

  it("exige un User-Agent", () => {
    expect(() => loadEnv({ DATABASE_URL: "f" })).toThrow();
  });
});
