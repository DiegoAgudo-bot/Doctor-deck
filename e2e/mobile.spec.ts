import { deckId, expect, test } from "./fixtures";

test("al tocar una carta sale su hoja con enlace a la ficha", async ({ page }) => {
  await page.goto(`/decks/${await deckId(page, "Teferi copia")}?tab=missing`);
  const card = page.locator(".hov:visible").first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.tap();
  const sheet = page.locator("dialog.sheet[open]");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Ver ficha" })).toHaveAttribute(
    "href",
    /^\/cards\//,
  );
});

for (const path of [
  "/",
  "/analyze",
  "/collection",
  "/cards",
  "/decks",
  "/community",
  "/feed",
  "/groups",
  "/trades",
  "/settings",
  "/play",
]) {
  test(`${path} no se sale de la pantalla`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, "scroll horizontal").toBeLessThanOrEqual(1);
  });
}

test("en el móvil el buscador se abre en una hoja", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buscar", exact: true }).tap();
  const sheet = page.locator("dialog.gsearch-sheet[open]");
  await sheet.getByLabel("Buscar en Doctor Deck").fill("sol ring");
  await sheet
    .getByRole("option", { name: /Sol Ring/ })
    .first()
    .tap();
  await expect(page).toHaveURL(/\/cards\//);
});
