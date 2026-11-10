/**
 * Colores de la web (`globals.css`, tema «Pentacromo»: base neutra y la gema del logo como
 * firma), en oscuro y en claro, para que app y web se vean iguales.
 */
const dark = {
  bg: "#111214",
  panel: "#17181b",
  raised: "#1e2024",
  hover: "#26282d",
  line: "#2a2c31",
  lineStrong: "#383b41",
  text: "#e8e6e3",
  text2: "#aba7a1",
  text3: "#8a8680",
  accent: "#6cb0ff",
  onAccent: "#06182e",
  in: "#4fc16a",
  out: "#f06a5f",
  warn: "#e0ae3f",
  owned: "#4fc16a",
  inuse: "#b78cf0",
  missing: "#8a8680",
  foil: "#e5c76b",
};

/** Los mismos papeles con los colores del tema claro de la web. */
const light: typeof dark = {
  bg: "#f4f4f5",
  panel: "#ffffff",
  raised: "#f8f8f9",
  hover: "#eeeef0",
  line: "#e1e1e4",
  lineStrong: "#cdcdd2",
  text: "#1c1b19",
  text2: "#55524d",
  text3: "#6f6b65",
  accent: "#0b63c9",
  onAccent: "#ffffff",
  in: "#1f7a35",
  out: "#c0352b",
  warn: "#8f6200",
  owned: "#1f7a35",
  inuse: "#7b48c2",
  missing: "#6f6b65",
  foil: "#8a6d10",
};

/**
 * El tema se elige en Ajustes (oscuro, claro o el del móvil) y lo deja `boot.ts` antes de cargar
 * la app: los estilos se crean al cargar cada módulo, así que cambiarlo recarga la app.
 */
export const isLight = (globalThis as { __DD_THEME?: string }).__DD_THEME === "light";

export const colors: Readonly<typeof dark> = isLight ? light : dark;

/** Las cinco caras de la gema del logo, en orden (la franja bajo la cabecera). */
export const gem = ["#4fc16a", "#f3e6c2", "#6cb0ff", "#8a7f9a", "#f06a5f"] as const;

/** Colores de maná para los puntos de identidad. */
export const manaColors: Record<string, string> = {
  W: "#f8f1d6",
  U: "#6aa7df",
  B: "#8f8279",
  R: "#e4704f",
  G: "#58a36b",
  C: "#bfb8ae",
};

export const radius = { sm: 6, md: 10, lg: 14 } as const;
