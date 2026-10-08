/**
 * Pide a EDHREC las recomendaciones de un comandante (usa la caché de 24 h) y muestra un resumen.
 * Sirve para comprobar que el adaptador entiende el JSON real.
 *
 * Uso:
 *   npm run edhrec:fetch -- "Atraxa, Praetors' Voice" [--theme counters] [--partner "Otro"] [--save ruta.json]
 * --save guarda el JSON crudo (desde la caché) para usarlo como fixture de tests.
 */
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { EdhrecError } from "@/adapters/edhrec/errors";
import { loadRecommendations } from "@/application/load-recommendations";
import { PrismaResponseCache } from "@/adapters/db/response-cache";
import { createContainer } from "@/server/container";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const commander = process.argv[2];
  if (!commander || commander.startsWith("--")) {
    throw new Error(
      'Uso: npm run edhrec:fetch -- "Nombre del comandante" [--theme x] [--partner "Otro"] [--save f.json]',
    );
  }
  const partner = arg("--partner");
  const query = { commanders: partner ? [commander, partner] : [commander], theme: arg("--theme") };
  const c = createContainer();
  const recs = await loadRecommendations(query, { source: c.edhrec, cards: c.cards });
  const pct = (x: number | null) => (x === null ? "  ?" : `${Math.round(x * 100)}%`.padStart(4));

  console.log(`${c.edhrec.pageUrl(query)}`);
  console.log(
    `Mazos: ${recs.totalDecks ?? "?"} · cartas: ${recs.cards.length} · sin resolver: ${recs.unresolved.length}`,
  );
  if (recs.stale) console.log(`AVISO: ${recs.warning}`);
  console.log(`Temas: ${recs.themes.map((t) => `${t.name} (${t.slug})`).join(", ") || "—"}`);
  console.log("\nTop 15 por synergy:");
  for (const r of [...recs.cards]
    .sort((a, b) => (b.synergy ?? -1) - (a.synergy ?? -1))
    .slice(0, 15)) {
    console.log(`  ${pct(r.inclusion)} incl · ${pct(r.synergy)} syn  ${r.card.name}`);
  }
  if (recs.unresolved.length > 0)
    console.log(`\nSin resolver: ${recs.unresolved.slice(0, 20).join(", ")}`);

  const save = arg("--save");
  if (save) {
    const cached = await new PrismaResponseCache(c.db).get(c.edhrec.pageUrl(query));
    if (cached) {
      await writeFile(save, JSON.stringify(JSON.parse(cached.body), null, 1));
      console.log(`\nJSON crudo guardado en ${save}`);
    }
  }
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  if (err instanceof EdhrecError)
    console.error(`EDHREC [${err.code}] ${err.message}${err.url ? `\n  ${err.url}` : ""}`);
  else console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
