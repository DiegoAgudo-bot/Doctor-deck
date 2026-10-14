import { expect, test } from "./fixtures";

test("ajustes: sesiones abiertas y silenciar un tipo de aviso", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Sesiones abiertas")).toBeVisible();
  await expect(page.getByText("este dispositivo")).toBeVisible();
  await expect(page.getByText("Cambiar la contraseña")).toBeVisible();

  const loans = page.getByRole("checkbox", { name: /Préstamos/ });
  await expect(loans).toBeChecked();
  await loans.uncheck();
  await expect(page.getByText("Guardado.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Préstamos/ })).not.toBeChecked();
  await page.getByRole("checkbox", { name: /Préstamos/ }).check();
  await expect(page.getByText("Guardado.")).toBeVisible();
});
