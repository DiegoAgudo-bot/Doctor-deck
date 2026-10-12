import { expect, test as base, type Page } from "@playwright/test";

/** Como `test`, pero falla si la página lanza algún error de JavaScript. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await use(errors);
      expect(errors, "errores de JavaScript en la página").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** El id público de uno de mis mazos, por su nombre. */
export async function deckId(page: Page, name: string): Promise<string> {
  const res = await page.request.get("/api/decks");
  const decks = (await res.json()) as { id: string; name: string }[];
  const deck = decks.find((d) => d.name === name);
  if (!deck) throw new Error(`No hay mazo «${name}»`);
  return deck.id;
}
