import { expect, test } from "./fixtures";

const euros = (s: string) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));

test("el buscador ordena por precio y filtra por precio máximo", async ({ page }) => {
  await page.goto("/cards");
  await expect(page.locator(".catalogtile").first()).toBeVisible();
  await page.getByLabel("Ordenar", { exact: true }).selectOption("price");
  await expect(page).toHaveURL(/sort=price/);
  await expect
    .poll(async () => {
      const prices = (await page.locator(".catalogtile-meta .mono").allTextContents())
        .filter((p) => p.includes("€"))
        .map(euros);
      return prices.every((p, i) => i === 0 || (prices[i - 1] ?? 0) >= p) && prices.length > 3;
    })
    .toBe(true);
  await page.getByLabel("Precio máx. €").fill("1");
  await expect(page).toHaveURL(/max=1/);
  await expect
    .poll(async () =>
      (await page.locator(".catalogtile-meta .mono").allTextContents())
        .filter((p) => p.includes("€"))
        .every((p) => euros(p) <= 1),
    )
    .toBe(true);
});

test("la ficha de un comandante deja crear un mazo", async ({ page }) => {
  await page.goto("/cards?q=teferi&commander=1");
  await page.locator(".catalogtile").first().click();
  await expect(page.getByRole("heading", { name: /Teferi, Temporal Archmage/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Crear mazo/ })).toBeVisible();
});
