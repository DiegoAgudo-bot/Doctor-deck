import { describe, expect, it } from "vitest";
import { frontFace, nameKey } from "./names";

describe("nameKey", () => {
  it("ignora mayúsculas, espacios y tildes", () => {
    expect(nameKey("  Sol   RING ")).toBe("sol ring");
    expect(nameKey("Lim-Dûl's Vault")).toBe("lim-dul's vault");
    expect(nameKey("Séance")).toBe("seance");
  });

  it("unifica comillas tipográficas", () => {
    expect(nameKey("Urza’s Saga")).toBe(nameKey("Urza's Saga"));
  });

  it("normaliza el separador de cartas de dos caras", () => {
    expect(nameKey("Fire//Ice")).toBe("fire // ice");
    expect(nameKey("Fire / Ice")).toBe("fire // ice");
    expect(nameKey("Delver of Secrets  //  Insectile Aberration")).toBe(
      "delver of secrets // insectile aberration",
    );
  });
});

describe("frontFace", () => {
  it("devuelve la primera cara", () => {
    expect(frontFace("Delver of Secrets // Insectile Aberration")).toBe("Delver of Secrets");
    expect(frontFace("Sol Ring")).toBe("Sol Ring");
  });
});
