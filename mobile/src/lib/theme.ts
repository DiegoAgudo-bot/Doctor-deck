/** Colores de la web en modo oscuro (`globals.css`), para que app y web se vean iguales. */
export const colors = {
  bg: "#131313",
  panel: "#1a1a1a",
  raised: "#222222",
  hover: "#2a2a2a",
  line: "#2c2c2c",
  lineStrong: "#3a3a3a",
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
