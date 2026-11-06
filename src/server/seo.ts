import { pick, type Locale } from "@/domain/i18n/locale";
import { formatEuros } from "@/domain/suggestions/format";
import type { CardDetailDTO } from "./card-dto";

/** Une las partes en una sola línea y la corta por una palabra (las descripciones ~160). */
export function metaDescription(parts: (string | null | undefined)[], max = 160): string {
  const text = parts
    .filter((p): p is string => Boolean(p))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut.slice(0, max - 1)).replace(/[\s,.;:—-]+$/, "")}…`;
}

/** "Sol Ring (Artifact): texto de reglas… Precio desde 1,20 €, 80 ediciones." */
export function cardDescription(d: CardDetailDTO, locale: Locale = "es"): string {
  const t = (es: string, en: string) => pick(locale, es, en);
  const n = d.printings.length;
  const facts = [
    d.minPrice !== null
      ? `${t("precio desde", "price from")} ${formatEuros(d.minPrice, locale)}`
      : null,
    n > 0 ? (n === 1 ? t("1 edición", "1 printing") : t(`${n} ediciones`, `${n} printings`)) : null,
  ].filter(Boolean);
  const tail =
    (facts.length > 0 ? `${facts.join(", ").replace(/^p/, "P")}. ` : "") +
    (d.commander
      ? t("Mazos de Commander con ella de comandante.", "Commander decks led by it.")
      : t("Roles e histórico de precios para Commander.", "Commander roles and price history."));
  // El texto de reglas se recorta para que el precio y las ediciones quepan siempre.
  const head = metaDescription(
    [`${d.card.name} (${d.card.typeLine}):`, d.oracleText],
    155 - tail.length,
  );
  return `${head} ${tail}`;
}
