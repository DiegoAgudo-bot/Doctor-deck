import type { Card } from "./types";

/** Texto de reglas preparado: minúsculas, sin reminder text, nombre propio → "this". */
export function rulesText(card: Card): string {
  let text = (card.oracleText ?? "").toLowerCase();
  for (const n of card.name.toLowerCase().split(" // ")) {
    if (n) text = text.split(n).join("this");
  }
  return text.replace(/\([^)]*\)/g, " ").replace(/[ \t]+/g, " ");
}
