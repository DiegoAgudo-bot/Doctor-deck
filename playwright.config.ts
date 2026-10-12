import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de navegador (`npm run e2e`) contra la app ya compilada (`npm run build`), con una BD
 * de pruebas sin red (`scripts/e2e-db.ts`). En el CI corren en cada push y PR.
 */
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    locale: "es-ES",
    storageState: "e2e/.auth/user.json",
  },
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    { name: "movil", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${BASE}/api/status`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: "file:./data/e2e.db",
      BETTER_AUTH_URL: BASE,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
      IMAGE_CACHE_DIR: "data/e2e-images",
      ADMIN_EMAILS: "e2e@example.com",
      HTTP_USER_AGENT: "DoctorDeck-e2e/0.1 (pruebas)",
    },
  },
});
