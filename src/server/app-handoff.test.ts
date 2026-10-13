import { describe, expect, it } from "vitest";
import { createHandoff, sessionCookies, takeHandoff } from "./app-handoff";

describe("app-handoff", () => {
  it("un código vale una vez y caduca a los 60 s", () => {
    const code = createHandoff(["a=1"], 1000);
    expect(takeHandoff(code, 2000)).toEqual(["a=1"]);
    expect(takeHandoff(code, 2000)).toBeNull();
    const old = createHandoff(["a=1"], 1000);
    expect(takeHandoff(old, 1000 + 61_000)).toBeNull();
  });

  it("solo copia las cookies de sesión", () => {
    expect(
      sessionCookies("x=1; __Secure-better-auth.session_token=abc.def; better-auth.session_data=z"),
    ).toEqual(["__Secure-better-auth.session_token=abc.def", "better-auth.session_data=z"]);
  });
});
