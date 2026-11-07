/** 1.5 → "1,50 €" */
export const formatEuros = (x: number, locale: "es" | "en" = "es") =>
  locale === "en" ? `€${x.toFixed(2)}` : `${x.toFixed(2).replace(".", ",")} €`;
