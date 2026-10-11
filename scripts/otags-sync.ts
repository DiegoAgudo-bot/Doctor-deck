/**
 * Descarga las etiquetas de Scryfall Tagger (`otag:`) que dan roles (ver `OTAG_ROLES`) y las
 * guarda en la BD. `scryfall:sync` ya lo hace una vez por semana; esto es para forzarlo o probar.
 * Uso: npm run otags:sync [-- --force] [-- --tag ramp]
 */
import "dotenv/config";
import { syncOracleTags } from "@/application/sync-otags";
import { OTAGS } from "@/domain/roles/otags";
import { createContainer } from "@/server/container";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const c = createContainer();
  const only = arg("--tag");
  const tags = only ? [only] : OTAGS;
  const results = await syncOracleTags(
    tags,
    { source: c.tagger, writer: c.cards },
    { force: process.argv.includes("--force") || only !== undefined },
  );
  for (const r of results) {
    const what =
      r.status === "synced"
        ? `${r.cards} cartas`
        : r.status === "fresh"
          ? `al día (${r.cards} cartas)`
          : `ERROR: ${r.error}`;
    console.log(`otag:${r.tag.padEnd(14)} ${what}`);
    if (r.status === "synced" && r.cards === 0) {
      console.warn(`  otag:${r.tag} no tiene cartas: ¿ha cambiado de nombre en Scryfall Tagger?`);
    }
  }
  await c.db.$disconnect();
  if (results.some((r) => r.status === "failed")) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
