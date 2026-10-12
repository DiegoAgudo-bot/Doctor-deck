import { deckId, expect, test } from "./fixtures";

test("«en otros mazos» dice cuáles y dónde", async ({ page }) => {
  await page.goto(`/decks/${await deckId(page, "Teferi copia")}`);
  const others = page.getByRole("button", { name: /en otros mazos/ });
  await expect(others).toBeVisible({ timeout: 30_000 });
  await others.click();
  const dialog = page.getByRole("dialog", { name: "En otros mazos" });
  await expect(dialog.locator(".kv", { hasText: "Sol Ring" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Teferi control" }).first()).toHaveAttribute(
    "href",
    /^\/decks\//,
  );
  await page.keyboard.press("Escape");

  // La lista marca esas cartas.
  await page.getByRole("button", { name: /^Lista\s*\d+$/ }).click();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByText("en Teferi control").first()).toBeVisible();
});

test("mis mazos se listan", async ({ page }) => {
  await page.goto("/decks");
  await expect(page.getByText("Teferi control").first()).toBeVisible();
  await expect(page.getByText("Teferi copia").first()).toBeVisible();
});
