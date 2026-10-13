import { expect, test } from "./fixtures";

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
