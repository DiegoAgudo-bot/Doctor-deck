import { expect, test } from "./fixtures";
import { DECK } from "./global-setup";

test.describe("sin cuenta", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("«Ver un ejemplo» de la portada analiza el mazo de ejemplo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver un ejemplo" }).click();
    await expect(page.getByRole("heading", { name: "Teferi, Temporal Archmage" })).toBeVisible({
      timeout: 30_000,
    });
    // Sin colección no hay cambios que proponer: se abre en lo que falta.
    await expect(page.getByRole("button", { name: /^Qué me falta/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("el analizador avisa de que falta la colección y ofrece el ejemplo", async ({ page }) => {
    await page.goto("/analyze?new=1");
    await expect(page.getByText("Aún no tengo tu colección.")).toBeVisible();
    await page.getByRole("button", { name: "Probar con un mazo de ejemplo" }).click();
    await expect(page.getByRole("heading", { name: "Teferi, Temporal Archmage" })).toBeVisible({
      timeout: 30_000,
    });
  });
});

test("al volver de crear la cuenta se abre «Guardar mazo»", async ({ page }) => {
  await page.addInitScript((input) => {
    localStorage.setItem(
      "deck-doctor:mazo",
      JSON.stringify({ input, theme: "", locked: [], excluded: [], deckId: null, name: "" }),
    );
  }, DECK);
  await page.goto("/analyze?analyze=1&save=1");
  await expect(page.getByRole("dialog", { name: "Guardar mazo" })).toBeVisible({
    timeout: 30_000,
  });
});

test.describe("registro", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sin repetir la contraseña: se puede ver y el nombre es opcional", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Repite la contraseña")).toHaveCount(0);
    const password = page.getByLabel(/^Contraseña/);
    await password.fill("secreta123");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Ver" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Nombre (opcional)")).not.toHaveAttribute("required", "");
  });

  test("«Guardar» sin cuenta vuelve al mazo para guardarlo", async ({ page }) => {
    await page.goto("/analyze?sample=1");
    await page.getByRole("button", { name: "Guardar", exact: true }).click({ timeout: 30_000 });
    const dialog = page.getByRole("dialog", { name: "Guardar mazo" });
    await expect(dialog.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      `/signup?next=${encodeURIComponent("/analyze?analyze=1&save=1")}`,
    );
  });
});

test.describe("portada", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sin cuenta, la portada viene en el HTML del servidor", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toContain("Mejora tus mazos con las cartas");
    expect(html).toContain("Preguntas frecuentes");
    expect(html).toContain("Lo último de la comunidad");
  });

  test("enseña mazos reales de la comunidad y las preguntas frecuentes", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Teferi (control|copia)/ }).first(),
    ).toHaveAttribute("href", /^\/decks\//);
    await page.getByText("¿Necesito cuenta?").click();
    await expect(page.getByText(/No para analizar un mazo/)).toBeVisible();
  });
});
