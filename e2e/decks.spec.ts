import { DECK } from "./global-setup";
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

test("en un mazo guardado, cambiar el tema se guarda solo", async ({ page }) => {
  const id = await deckId(page, "Teferi control");
  await page.goto(`/decks/${id}`);
  const control = page.getByRole("radio", { name: /^Control/ });
  await expect(control).toBeVisible({ timeout: 30_000 });
  const saving = page.waitForResponse(
    (r) => r.url().endsWith("/api/decks") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await control.click();
  expect((await saving).ok()).toBe(true);
  // Al volver a abrirlo, sigue con el tema elegido (sin pulsar «Guardar»).
  await page.reload();
  await expect(page.getByRole("radio", { name: /^Control/ })).toHaveAttribute(
    "aria-checked",
    "true",
    { timeout: 30_000 },
  );
  // Ya no hay «Guardar»: se guarda solo y lo demás está en Ajustes.
  await expect(page.getByRole("button", { name: "Ajustes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar", exact: true })).toHaveCount(0);
  // Lo dejo como estaba para el resto de pruebas.
  const restoring = page.waitForResponse(
    (r) => r.url().endsWith("/api/decks") && r.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByRole("radio", { name: /^General/ }).click();
  expect((await restoring).ok()).toBe(true);
});

test("desde el mazo: renombrar y borrar en Ajustes", async ({ page }) => {
  const res = await page.request.post("/api/decks", {
    data: { name: "Mazo para ajustes", input: DECK, visibility: "private" },
  });
  const { id } = (await res.json()) as { id: string };
  await page.goto(`/decks/${id}`);
  await page.getByRole("button", { name: "Ajustes" }).click({ timeout: 30_000 });
  const dialog = page.getByRole("dialog", { name: "Ajustes del mazo" });
  await dialog.getByLabel("Nombre").fill("Mazo renombrado");
  await dialog.getByRole("button", { name: "Cambiar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mazo renombrado" })).toBeVisible();

  await dialog.getByRole("button", { name: "Borrar mazo" }).click();
  await dialog.getByRole("button", { name: "Borrar «Mazo renombrado»" }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByText("Mazo renombrado")).toHaveCount(0);
});

test("desde la ficha de una carta se añade a uno de mis mazos", async ({ page }) => {
  const res = await page.request.post("/api/decks", {
    data: { name: "Mazo para añadir", input: DECK, visibility: "private" },
  });
  const { id } = (await res.json()) as { id: string };
  const search = await page.request.get("/api/cards/search?q=Tamiyo%27s%20Logbook&limit=1");
  const [card] = (await search.json()) as { oracleId: string }[];
  await page.goto(`/cards/${card?.oracleId}`);
  await page.getByRole("button", { name: "Añadir a un mazo" }).click();
  const dialog = page.getByRole("dialog", { name: /Añadir «Tamiyo's Logbook» a un mazo/ });
  await dialog.getByRole("button", { name: /Mazo para añadir/ }).click();
  await expect(dialog.getByText("Añadida a «Mazo para añadir».")).toBeVisible();
  // Otra copia no: en Commander solo puede haber una.
  await dialog.getByRole("button", { name: /Mazo para añadir/ }).click();
  await expect(dialog.getByText(/ya está en el mazo/)).toBeVisible();

  const deck = (await (await page.request.get(`/api/decks/${id}`)).json()) as { input: string };
  expect(deck.input).toContain("1 Tamiyo's Logbook");
  await page.request.delete(`/api/decks/${id}`);
});

test("«Nuevo mazo» importa una lista y la guarda", async ({ page }) => {
  await page.goto("/decks/new?from=list");
  await page.getByLabel("Lista o enlace").fill(DECK);
  await page.getByLabel(/^Nombre/).fill("Importado en e2e");
  await page.getByRole("button", { name: "Importar y guardar" }).click();
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Importado en e2e" })).toBeVisible({
    timeout: 30_000,
  });
  await page.request.delete(`/api/decks/${page.url().split("/").at(-1)}`);
});

test("«Nuevo mazo» propone los comandantes de mi colección", async ({ page }) => {
  await page.goto("/decks/new");
  await page.getByRole("button", { name: /Teferi/ }).click();
  await expect(page.getByText("2 · Cómo lo montas")).toBeVisible();
});
