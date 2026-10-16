import { expect, test } from "./fixtures";

const names = (page: import("@playwright/test").Page) =>
  page
    .locator("figure .cardimg")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.getAttribute("alt") ?? ""),
    );

test("ordena por precio en las dos direcciones y lo recuerda", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.locator("figure").first()).toBeVisible();
  await page.getByLabel("Ordenar", { exact: true }).selectOption("precio");
  await expect.poll(async () => (await names(page))[0]).toBe("Mana Crypt");
  await page.getByRole("button", { name: /^Orden:/ }).click();
  await expect.poll(async () => (await names(page)).at(-1)).toBe("Mana Crypt");

  // Se recuerda al volver (y en el servidor, para otro navegador).
  await page.reload();
  await expect(page.getByLabel("Ordenar", { exact: true })).toHaveValue("precio");
  await expect.poll(async () => (await names(page)).at(-1)).toBe("Mana Crypt");
  await expect
    .poll(async () => (await (await page.request.get("/api/me/prefs")).json()) as unknown)
    .toMatchObject({ prefs: { collection: { sort: "precio", dir: "asc" } } });
});

test("filtra las que pueden ser comandante y desde una se crea un mazo", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.locator("figure").first()).toBeVisible();
  // Los filtros secundarios van plegados detrás de «Más filtros».
  await page.getByRole("button", { name: /^Más filtros/ }).click();
  const commander = page.getByLabel("Pueden ser comandante");
  await commander.check();
  await expect(page.getByRole("button", { name: "Más filtros · 1" })).toBeVisible();
  await expect
    .poll(async () => (await names(page)).sort())
    .toEqual(["Teferi, Temporal Archmage", "Ultros, Obnoxious Octopus"]);
  await page.getByRole("button", { name: "Teferi, Temporal Archmage", exact: true }).click();
  await expect(page.getByRole("link", { name: "Crear mazo con Teferi" })).toHaveAttribute(
    "href",
    /^\/decks\/new\?commander=/,
  );
  await page.keyboard.press("Escape");
  // Que no se quede recordado para el resto de pruebas.
  await commander.uncheck();
  await expect.poll(async () => (await names(page)).length).toBeGreaterThan(2);
});

test("filtros como los de ManaBox: tipos, valor de maná y texto de reglas", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.locator("figure").first()).toBeVisible();
  await page.getByRole("button", { name: /^Más filtros/ }).click();
  const artifact = page.getByRole("button", { name: "Artefacto", exact: true });
  await artifact.click();
  await expect(page.getByRole("button", { name: "Más filtros · 1" })).toBeVisible();
  await expect.poll(async () => (await names(page)).sort()).toContain("Sol Ring");
  await page.getByLabel("Valor de maná: desde").fill("2");
  await expect.poll(async () => names(page)).not.toContain("Sol Ring");
  await page.getByLabel("Valor de maná: desde").fill("");
  await page.getByRole("textbox", { name: "Texto de reglas" }).fill("flip a coin");
  await expect.poll(async () => names(page)).toEqual(["Mana Crypt"]);
  // Que no se quede recordado para el resto de pruebas.
  await page.getByRole("button", { name: "Quitar filtros" }).first().click();
  await expect.poll(async () => (await names(page)).length).toBeGreaterThan(2);
});
