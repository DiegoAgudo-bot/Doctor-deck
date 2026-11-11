import { expect, test } from "./fixtures";

test("la lista de compra junta lo que falta en todos mis mazos", async ({ page }) => {
  await page.goto("/shopping");
  await expect(page.getByRole("heading", { name: "Lista de compra" })).toBeVisible();
  // Los dos mazos de prueba llevan las mismas cartas y solo tengo una copia: falta una de cada.
  const row = page.getByRole("row").filter({ hasText: "Mana Crypt" });
  await expect(row).toBeVisible();
  await expect(row.getByRole("link", { name: "Teferi control" })).toBeVisible();
  await expect(row.getByRole("link", { name: "Teferi copia" })).toBeVisible();
  // Filtrar por un mazo no quita lo que ese mazo pide.
  await page.getByRole("combobox").selectOption({ label: "Teferi copia" });
  await expect(row).toBeVisible();
});
