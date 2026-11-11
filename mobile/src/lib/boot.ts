import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";

/**
 * Preferencias que hay que saber antes de cargar el resto de la app: el idioma y el tema elegidos
 * a mano en Ajustes. `t()` y `colors` se resuelven al cargar cada módulo, así que se leen aquí
 * (lectura síncrona) y se dejan en `globalThis` para `lang.ts` y `theme.ts`, que no importan
 * nada. Cambiarlas recarga la app (`applyBootPrefs`).
 */
export type LangPref = "auto" | "es" | "en";
export type ThemePref = "dark" | "light" | "system";

const LANG_KEY = "doctordeck.lang";
const THEME_KEY = "doctordeck.theme";

const read = (key: string) => {
  try {
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
};

const lang = read(LANG_KEY);
const theme = read(THEME_KEY);

export const langPref: LangPref = lang === "es" || lang === "en" ? lang : "auto";
export const themePref: ThemePref = theme === "light" || theme === "system" ? theme : "dark";

const globals = globalThis as { __DD_LANG?: string; __DD_THEME?: string };
if (langPref !== "auto") globals.__DD_LANG = langPref;
globals.__DD_THEME =
  themePref === "system" ? (Appearance.getColorScheme() === "light" ? "light" : "dark") : themePref;

/** Guarda la preferencia; hay que recargar la app para que se vea (`reloadAppAsync`). */
export function saveBootPrefs(prefs: { lang?: LangPref; theme?: ThemePref }) {
  if (prefs.lang) SecureStore.setItem(LANG_KEY, prefs.lang);
  if (prefs.theme) SecureStore.setItem(THEME_KEY, prefs.theme);
}
