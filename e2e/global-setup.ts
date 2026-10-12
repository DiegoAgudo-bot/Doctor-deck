import { mkdirSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";

export const E2E_EMAIL = "e2e@example.com";

/** Lista de dos mazos con las mismas cartas: así las del segundo están "en otros mazos". */
export const DECK = [
  "1 Teferi, Temporal Archmage *CMDR*",
  "1 Sol Ring",
  "1 Mana Crypt",
  "1 Dig Through Time",
  "30 Island",
].join("\n");

/**
 * Una cuenta para todas las pruebas (Better Auth limita los registros seguidos), con algunas cartas
 * en la colección y dos mazos guardados. Deja la sesión en `e2e/.auth/user.json`.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3100";
  const api = await request.newContext({ baseURL });
  // La BD se crea de cero en cada ejecución: el email puede ser fijo (y es el de administración).
  const email = E2E_EMAIL;
  const signUp = await api.post("/api/auth/sign-up/email", {
    data: { email, password: "password123", name: "Prueba" },
  });
  if (!signUp.ok()) throw new Error(`No se pudo crear la cuenta: ${signUp.status()}`);
  const names = ["Sol Ring", "Mana Crypt", "Dig Through Time", "Teferi, Temporal Archmage"];
  const added = await api.post("/api/collection/cards", {
    data: {
      cards: [...names, "Lantern Flare", "Ultros, Obnoxious Octopus"].map((name) => ({
        name,
        quantity: 1,
      })),
    },
  });
  if (!added.ok()) throw new Error(`No se pudieron añadir cartas: ${added.status()}`);
  for (const name of ["Teferi control", "Teferi copia"]) {
    const saved = await api.post("/api/decks", { data: { name, input: DECK } });
    if (!saved.ok()) throw new Error(`No se pudo guardar el mazo: ${saved.status()}`);
  }
  mkdirSync("e2e/.auth", { recursive: true });
  await api.storageState({ path: "e2e/.auth/user.json" });
  await api.dispose();
}
