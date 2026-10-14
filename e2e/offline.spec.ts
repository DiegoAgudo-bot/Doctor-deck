import { expect, test } from "./fixtures";

test("el contador de vidas funciona sin conexión", async ({ page, context }) => {
  await page.goto("/play");
  // Espera a que el service worker controle la página y haya guardado /play.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 50 && !(await caches.match("/play")); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Empezar partida/ }).click();
  const first = page.getByRole("region").filter({ hasText: "40" }).first();
  await expect(first).toBeVisible();
  await first.getByRole("button", { name: "Quitar una vida" }).click();
  await expect(page.getByText("39", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
