/**
 * Colores de la web en modo oscuro (`globals.css`, tema «Pentacromo»: base neutra y la gema del
 * logo como firma), para que app y web se vean iguales.
 */
export const colors = {
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
} as const;

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
