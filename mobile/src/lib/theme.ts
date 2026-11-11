/**
 * Colores de la web (`globals.css`): el tema «Tapete» por defecto y el claro, para que app y web
 * se vean iguales.
 */
/**
 * Tema «Tapete», como la web: el fondo es fieltro y el acento, latón. En la app los paneles no son
 * hojas de cartulina sino zonas más oscuras del mismo fieltro: aquí cada pantalla fija sus colores
 * al cargar, y así el texto sigue siendo claro sobre oscuro en todas partes.
 */
const dark = {
  bg: "#153a36",
  panel: "#0f2b28",
  raised: "#1d4a45",
  hover: "#27584f",
  line: "#2b5952",
  lineStrong: "#4b7a71",
  text: "#f3ecd9",
  text2: "#c5d1c8",
  text3: "#a3b4aa",
  accent: "#c9a24b",
  onAccent: "#1d1708",
  in: "#86d99f",
  out: "#f5a091",
  warn: "#ecc968",
  owned: "#86d99f",
  inuse: "#cdb2f5",
  missing: "#a3b4aa",
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

/** Titulares estrechos, como en la web (Roboto Condensed, que ya trae Android). */
export const displayFont = "sans-serif-condensed";
