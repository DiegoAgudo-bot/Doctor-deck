/**
 * Parsea y resuelve una lista de mazo (fichero de texto o link de Archidekt/Moxfield) contra el
 * catálogo local.
 * Uso: npm run deck:check -- "ruta/a/lista.txt"   |   npm run deck:check -- "https://archidekt.com/decks/123"
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { loadDeck } from "@/application/load-deck";
import { createContainer } from "@/server/container";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Uso: npm run deck:check -- "ruta/a/lista.txt"');
  const c = createContainer();
  const input = /^https?:\/\//i.test(file) ? file : await readFile(file, "utf8");
  const { deck, skipped, issues, source, deckName } = await loadDeck(input, {
    sources: c.deckSources,
    cards: c.cards,
  });
  console.log(`Fuente: ${source}${deckName ? ` · ${deckName}` : ""}`);
  const count = deck.commanders.length + deck.cards.reduce((n, x) => n + x.quantity, 0);
  console.log(
    `Comandante (${deck.commanderSource}): ${deck.commanders.map((x) => x.name).join(" + ") || "—"}`,
  );
  if (deck.commanderCandidates.length > 0) {
    console.log(`  Candidatos: ${deck.commanderCandidates.map((x) => x.name).join(", ")}`);
  }
  console.log(`Cartas: ${count}`);
  for (const e of deck.unresolved) console.log(`  No encontrada (línea ${e.line}): ${e.name}`);
  for (const s of skipped)
    console.log(`  Ignorada (línea ${s.line}): ${s.text.trim()} — ${s.reason}`);
  for (const i of issues)
    console.log(
      `  Aviso: ${i.kind}${"card" in i ? ` ${i.card.name}` : ""}${i.kind === "size" ? ` (${i.count})` : ""}`,
    );
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
