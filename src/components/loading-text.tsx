"use client";

import { useT } from "./i18n";
import { Loading } from "./ui";

/** `<Loading>` con el texto en el idioma de la página (para los `fallback` de las páginas). */
export function LoadingText({ es, en }: { es: string; en: string }) {
  const t = useT();
  return <Loading>{t(es, en)}</Loading>;
}
