import { expect, test } from "./fixtures";

test("atajos de teclado: ayuda, ir a un sitio y pestañas del mazo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible();
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Atajos de teclado" });
  await expect(help).toBeVisible();
  // Con un diálogo abierto los atajos no hacen nada.
  await page.keyboard.press("n");
  await expect(page).toHaveURL(/\/$/);
  await help.getByRole("button", { name: "Cerrar" }).last().click();
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await expect(page).toHaveURL(/\/collection$/);
  await page.keyboard.press("g");
  await page.keyboard.press("m");
  await expect(page).toHaveURL(/\/decks$/);
  await page
    .getByRole("link", { name: /Teferi control/ })
    .first()
    .click();
  await expect(page.getByRole("button", { name: /^Lista\s*\d+$/ })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByRole("button", { name: /^Lista\s*\d+$/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
