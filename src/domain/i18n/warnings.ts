import type { Locale } from "./locale";

/**
 * Los avisos que dan los adaptadores (datos de la comunidad o combos guardados porque la web
 * falló) salen en español y se guardan en caché así. En inglés se reconocen aquí y se dan
 * traducidos; uno desconocido queda como un aviso genérico (nunca en español).
 */
export function localizeWarning(warning: string | null, locale: Locale): string | null {
  if (warning === null || locale !== "en") return warning;
  const date = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/.exec(warning)?.[0];
  if (warning.startsWith("No se pudieron actualizar las recomendaciones")) {
    return `Couldn't refresh the community data; using data saved${date ? ` on ${date}` : ""}.`;
  }
  if (warning.startsWith("Hay más combos")) return "There are more combos than shown.";
  if (/combos guardados/.test(warning)) {
    return `Couldn't refresh the combos; showing the ones saved${date ? ` on ${date}` : ""}.`;
  }
  return "Some data couldn't be refreshed; you may be seeing a saved copy.";
}
