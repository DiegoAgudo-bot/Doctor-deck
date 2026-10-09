import { describe, expect, it } from "vitest";
import { usernameBase, usernameCandidates, usernameProblem } from "./username";

describe("nombres de usuario", () => {
  it("valida formato y reservados", () => {
    expect(usernameProblem("diego_99")).toBeNull();
    expect(usernameProblem("Diego")).toBe("format");
    expect(usernameProblem("ab")).toBe("format");
    expect(usernameProblem("9diego")).toBe("format");
    expect(usernameProblem("diego-agudo")).toBe("format");
    expect(usernameProblem("a".repeat(21))).toBe("format");
    expect(usernameProblem("admin")).toBe("reserved");
  });

  it("genera una base a partir del nombre o del email", () => {
    expect(usernameBase("Diego Agudo", "x@y.z")).toBe("diego_agudo");
    expect(usernameBase("Íñigo Ñúñez", "x@y.z")).toBe("inigo_nunez");
    expect(usernameBase("??", "maria.lopez@x.es")).toBe("maria_lopez");
    expect(usernameBase("Jo", "42@x.es")).toBe("jugador");
    expect(usernameBase("Admin", "a@b.c")).toBe("jugador");
  });

  it("propone sufijos numéricos sin pasarse de 20 caracteres", () => {
    const it = usernameCandidates("abcdefghijklmnopqrst");
    expect([it.next().value, it.next().value, it.next().value]).toEqual([
      "abcdefghijklmnopqrst",
      "abcdefghijklmnopqrs2",
      "abcdefghijklmnopqrs3",
    ]);
  });
});
