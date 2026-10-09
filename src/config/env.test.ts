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

describe("loadEnv: usuarios", () => {
  const base = { DATABASE_URL: "f", HTTP_USER_AGENT: "u" };
  it("en producción exige BETTER_AUTH_SECRET", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", BETTER_AUTH_SECRET: "x".repeat(32) }),
    ).not.toThrow();
  });
  it("las variables vacías cuentan como no definidas", () => {
    const env = loadEnv({ ...base, GOOGLE_CLIENT_ID: "", SMTP_URL: "", BETTER_AUTH_SECRET: "" });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.SMTP_URL).toBeUndefined();
    expect(env.BETTER_AUTH_SECRET).toBeUndefined();
  });
});
