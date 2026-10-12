import { expect, test } from "./fixtures";

test("los errores del navegador llegan al registro de administración", async ({ page }) => {
  await page.goto("/privacy");
  const status = await page.evaluate(async () => {
    const r = await fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "TypeError: e2e roto 42", path: "/decks/x?secreto=1" }),
    });
    return r.status;
  });
  expect(status).toBe(204);
  await page.goto("/admin/errors");
  const item = page.locator("li", { hasText: "e2e roto" });
  await expect(item).toBeVisible();
  await expect(item.getByText("/decks/x", { exact: true })).toBeVisible();
  await item.getByRole("button", { name: "Hecho" }).click();
  await expect(item).toHaveCount(0);
});
