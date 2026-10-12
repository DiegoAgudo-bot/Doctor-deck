import { expect, test } from "./fixtures";

test("el buscador de la cabecera encuentra cartas, mis mazos y lleva a la ficha", async ({
  page,
}) => {
  await page.goto("/decks");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("/");
  const input = page.getByLabel("Buscar en Doctor Deck").first();
  await expect(input).toBeFocused();
  await input.fill("teferi");
  const list = page.locator(".gsearch-pop");
  await expect(
    list.getByRole("option", { name: /^Teferi, Temporal Archmage/ }).first(),
  ).toBeVisible();
  await expect(list.getByRole("option", { name: /Teferi copia/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/cards\/[0-9a-f-]{36}$/);
});

for (const width of [800, 1024, 1280]) {
  test(`la cabecera cabe a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(() => {
      const bar = document.querySelector(".topbar");
      return bar ? bar.scrollWidth - bar.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
