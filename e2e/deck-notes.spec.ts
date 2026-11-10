import { expect, test } from "./fixtures";

test("descripción del mazo, nota en una carta y comparar con el mazo medio", async ({ page }) => {
  await page.goto("/decks");
  await page
    .getByRole("link", { name: /Teferi copia/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Añadir una descripción" }).click();
  await page.getByLabel("Descripción").fill("Control azul de prueba.");
  await page.getByRole("button", { name: "Guardar descripción" }).click();
  await expect(page.getByText("Control azul de prueba.")).toBeVisible();

  await page.getByRole("button", { name: /^Lista\s*\d+$/ }).click();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.getByRole("button", { name: "Añadir una nota a Sol Ring" }).click();
  await page.getByLabel("Nota", { exact: true }).fill("Siempre en la mano inicial");
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await expect(page.getByRole("button", { name: "Siempre en la mano inicial" })).toBeVisible();

  await page.getByRole("button", { name: "Comparar" }).click();
  await expect(page.getByText("Solo en tu mazo")).toBeVisible();
  await expect(page.getByText("Solo en el mazo medio")).toBeVisible();
});
