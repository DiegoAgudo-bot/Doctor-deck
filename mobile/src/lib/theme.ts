/**
 * Colores de la web en modo oscuro (`globals.css`, tema «Medianoche»: el azul noche del icono),
 * para que app y web se vean iguales.
 */
export const colors = {
  bg: "#0e131b",
  panel: "#131a24",
  raised: "#1a2230",
  hover: "#212b3b",
  line: "#232d3c",
  lineStrong: "#2f3b4e",
  text: "#e6e9ee",
  text2: "#a3acba",
  text3: "#7f8a9b",
  accent: "#6cb0ff",
  onAccent: "#06182e",
  in: "#4fc16a",
  out: "#f06a5f",
  warn: "#e0ae3f",
  owned: "#4fc16a",
  inuse: "#b78cf0",
  missing: "#7f8a9b",
  foil: "#e5c76b",
} as const;

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
