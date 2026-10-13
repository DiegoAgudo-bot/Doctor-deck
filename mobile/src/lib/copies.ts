/** Idiomas y estados de una copia, como en ManaBox (mismos códigos que el servidor). */
export const LANGUAGE_OPTIONS = [
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "it", label: "IT" },
  { code: "pt", label: "PT" },
  { code: "ja", label: "JA" },
  { code: "ko", label: "KO" },
  { code: "ru", label: "RU" },
  { code: "zhs", label: "ZHS" },
] as const;

export const CONDITION_OPTIONS = [
  { code: "mint", label: "M" },
  { code: "near_mint", label: "NM" },
  { code: "excellent", label: "EX" },
  { code: "good", label: "GD" },
  { code: "lightly_played", label: "LP" },
  { code: "played", label: "PL" },
  { code: "poor", label: "PO" },
] as const;

export const conditionShort = (c: string | null) =>
  CONDITION_OPTIONS.find((o) => o.code === c)?.label ?? null;
