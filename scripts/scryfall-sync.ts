/**
 * Descarga (si hay versión nueva) los bulk data de Scryfall y los vuelca a SQLite.
 * Uso: npm run scryfall:sync [-- --force] [-- --skip-download]
 */
import "dotenv/config";
import { ensureBulkFile, readJsonArray } from "@/adapters/scryfall/bulk";
import { safeMappers } from "@/adapters/scryfall/mapping";
import { syncScryfallCatalog } from "@/application/sync-scryfall";
import { createContainer } from "@/server/container";
import path from "node:path";

async function main() {
  const force = process.argv.includes("--force");
  const skipDownload = process.argv.includes("--skip-download");
  const c = createContainer();
  const dir = c.env.SCRYFALL_DATA_DIR;

  let oraclePath = path.join(dir, "oracle_cards.json");
  let defaultPath = path.join(dir, "default_cards.json");
  if (!skipDownload) {
    for (const type of ["oracle_cards", "default_cards"] as const) {
      const f = await ensureBulkFile(c.scryfallHttp, dir, type, force);
      console.log(`${type}: ${f.downloaded ? "descargado" : "ya actualizado"} (${f.updatedAt})`);
      if (type === "oracle_cards") oraclePath = f.path;
      else defaultPath = f.path;
    }
  }

  console.log("Volcando a SQLite…");
  const result = await syncScryfallCatalog(
    {
      oracleCards: () => readJsonArray(oraclePath),
      defaultCards: () => readJsonArray(defaultPath),
    },
    safeMappers,
    c.cards,
    (msg) => process.stdout.write(`\r  ${msg}      `),
  );
  console.log(
    `\nListo: ${result.cards} cartas, ${result.printings} impresiones, ${result.skipped} descartadas.`,
  );
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
