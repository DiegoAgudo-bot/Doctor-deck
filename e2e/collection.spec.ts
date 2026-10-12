import { expect, test } from "./fixtures";

const names = (page: import("@playwright/test").Page) =>
  page
    .locator("figure .cardimg")
    .evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? e.getAttribute("alt") ?? ""),
    );

test("ordena por precio en las dos direcciones y lo recuerda", async ({ page }) => {
  await page.goto("/collection");
  await expect(page.locator("figure").first()).toBeVisible();
  await page.getByLabel("Ordenar", { exact: true }).selectOption("precio");
  await expect.poll(async () => (await names(page))[0]).toBe("Mana Crypt");
  await page.getByRole("button", { name: /^Orden:/ }).click();
  await expect.poll(async () => (await names(page)).at(-1)).toBe("Mana Crypt");

  // Se recuerda al volver (y en el servidor, para otro navegador).
  await page.reload();
  await expect(page.getByLabel("Ordenar", { exact: true })).toHaveValue("precio");
  await expect.poll(async () => (await names(page)).at(-1)).toBe("Mana Crypt");
  await expect
    .poll(async () => (await (await page.request.get("/api/me/prefs")).json()) as unknown)
    .toMatchObject({ prefs: { collection: { sort: "precio", dir: "asc" } } });
});
