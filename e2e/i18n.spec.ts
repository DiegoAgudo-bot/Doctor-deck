import { expect, test } from "./fixtures";

test.describe("versión en inglés, sin sesión", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("la portada en inglés con sus versiones por idioma", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Upgrade your Commander");
    // Next puede repetir las etiquetas del <head> al terminar de cargar: se miran todas.
    const hrefs = (sel: string) =>
      page.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));
    expect(await hrefs('link[rel="alternate"][hreflang="es"]')).not.toContainEqual(
      expect.stringContaining("/en"),
    );
    for (const href of await hrefs('link[rel="canonical"]')) expect(href).toMatch(/\/en$/);
    // Los enlaces internos se quedan en inglés.
    await page.getByRole("link", { name: "Cards", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/cards/);
    await expect(page.getByRole("heading", { name: "Search cards" })).toBeVisible();
  });

  test("la ficha de una carta en inglés", async ({ page }) => {
    await page.goto("/en/cards?q=teferi&commander=1");
    await page.locator(".catalogtile").first().click();
    await expect(page).toHaveURL(/\/en\/cards\//);
    await expect(page.getByRole("link", { name: /Build a deck with/ })).toBeVisible();
    await expect(page.getByText("Can be commander").first()).toBeVisible();
  });

  test("cambiar de idioma se recuerda y /es lleva a la URL sin prefijo", async ({ page }) => {
    await page.goto("/cards");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/cards$/);
    // Con el inglés elegido, una URL en español lleva a la inglesa…
    await page.goto("/community");
    await expect(page).toHaveURL(/\/en\/community$/);
    // …hasta que se vuelve a elegir el español.
    await page.getByRole("link", { name: "Español" }).click();
    await expect(page).toHaveURL(/\/community$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await page.goto("/es/cards");
    await expect(page).toHaveURL(/\/cards$/);
  });

  test("las páginas privadas mandan a entrar en su idioma", async ({ page }) => {
    await page.goto("/en/decks");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fdecks/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("un sitemap por idioma con sus alternativas", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("/sitemap/es.xml");
    expect(robots).toContain("/sitemap/en.xml");
    const en = await (await request.get("/sitemap/en.xml")).text();
    expect(en).toContain("/en/cards</loc>");
    expect(en).toContain('hreflang="es"');
  });
});
