import { expect, test } from "./fixtures";

test("el escáner reconoce una carta por edición y número, y por nombre", async ({ page }) => {
  await page.goto("/privacy");
  const identify = async (lines: string[]) => {
    const res = await page.request.post("/api/scan/identify", { data: { lines } });
    expect(res.status()).toBe(200);
    return res.json();
  };
  const exact = await identify(["Anillo solar", "Artefacto", "0263 U", "C21 • ES"]);
  expect(exact.match).toMatchObject({ via: "set_number", card: { name: "Sol Ring" } });
  expect(exact.match.printing).toMatchObject({ setCode: "c21", collectorNumber: "263" });
  expect(exact.reading.language).toBe("es");

  const byName = await identify(["Dig Thr0ugh Time", "Instant"]);
  expect(byName.match).toMatchObject({ via: "name", card: { name: "Dig Through Time" } });
  expect((await identify(["Creature — Elf Druid"])).match).toBeNull();
});
