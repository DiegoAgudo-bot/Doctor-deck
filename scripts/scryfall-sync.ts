/**
 * Descarga (si hay versión nueva) los bulk data de Scryfall y los vuelca a SQLite.
 * Uso: npm run scryfall:sync [-- --force] [-- --skip-download]
 */
import "dotenv/config";
import { ensureBulkFile, readBulkFile } from "@/adapters/scryfall/bulk";
import { safeMappers } from "@/adapters/scryfall/mapping";
import { recordPriceSnapshot } from "@/application/prices";
import { syncScryfallCatalog } from "@/application/sync-scryfall";
import { createContainer } from "@/server/container";
import { existsSync } from "node:fs";
import path from "node:path";

/** Con --skip-download: el bulk ya descargado, en el formato nuevo (.jsonl.gz) o el antiguo. */
function existingBulk(dir: string, type: string): string {
  const jsonl = path.join(dir, `${type}.jsonl.gz`);
  return existsSync(jsonl) ? jsonl : path.join(dir, `${type}.json`);
}

async function main() {
  const force = process.argv.includes("--force");
  const skipDownload = process.argv.includes("--skip-download");
  const c = createContainer();
  const dir = c.env.SCRYFALL_DATA_DIR;

  let oraclePath = existingBulk(dir, "oracle_cards");
  let defaultPath = existingBulk(dir, "default_cards");
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
      oracleCards: () => readBulkFile(oraclePath),
      defaultCards: () => readBulkFile(defaultPath),
    },
    safeMappers,
    c.cards,
    (msg) => process.stdout.write(`\r  ${msg}      `),
  );
  console.log(
    `\nListo: ${result.cards} cartas, ${result.printings} impresiones, ${result.skipped} descartadas.`,
  );
  const snapshot = await recordPriceSnapshot({ prices: c.prices });
  console.log(`Precios del ${snapshot.date}: ${snapshot.cards} cartas de colecciones y mazos.`);
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
