import { describe, expect, it } from "vitest";
import { DIGEST_MAX_ITEMS, digestEmail, type DigestItem } from "./digest";

const item = (n: number): DigestItem => ({
  es: { title: `Aviso ${n}`, body: `Cuerpo <${n}>` },
  en: { title: `Notice ${n}`, body: `Body <${n}>` },
  path: `/decks/${n}`,
});

describe("correo del resumen semanal", () => {
  it("va en los dos idiomas, con enlaces y cómo darse de baja", () => {
    const mail = digestEmail({
      name: "Ana",
      items: [item(1), item(2)],
      siteUrl: "https://dd.test",
    });
    expect(mail.subject).toContain("Doctor Deck");
    expect(mail.text).toContain("Hola, Ana");
    expect(mail.text).toContain("- Aviso 1: Cuerpo <1>\n  https://dd.test/decks/1");
    expect(mail.text).toContain("- Notice 2: Body <2>");
    expect(mail.text).toContain("https://dd.test/settings");
    expect(mail.text).toContain("https://dd.test/en/settings");
    // En el HTML, el texto va escapado.
    expect(mail.html).toContain("Cuerpo &lt;1&gt;");
    expect(mail.html).not.toContain("Cuerpo <1>");
  });

  it("con muchos avisos enseña los primeros y dice cuántos quedan", () => {
    const items = Array.from({ length: DIGEST_MAX_ITEMS + 4 }, (_, i) => item(i));
    const mail = digestEmail({ name: "Ana", items, siteUrl: "https://dd.test" });
    expect(mail.text).toContain("…y 4 más: https://dd.test/notifications");
    expect(mail.text).not.toContain(`Aviso ${DIGEST_MAX_ITEMS + 1}:`);
  });
});
