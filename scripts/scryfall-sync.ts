/**
 * Descarga (si hay versión nueva) los bulk data de Scryfall y los vuelca a SQLite.
 * Uso: npm run scryfall:sync [-- --force] [-- --skip-download] [-- --skip-localized]
 *
 * Una vez por semana, además, los nombres y textos en otros idiomas (`all_cards`, ~400 MB que se
 * leen de la red sin guardarlos); `--force-localized` los descarga aunque no toque.
 */
import "dotenv/config";
import {
  bulkEntry,
  ensureBulkFile,
  readBulkFile,
  streamJsonLinesGz,
} from "@/adapters/scryfall/bulk";
import { safeMappers, toLocalizedRecord } from "@/adapters/scryfall/mapping";
import { syncLocalizations } from "@/application/sync-localizations";
import { HttpClient } from "@/adapters/http/http-client";
import { refreshDeckFacts } from "@/application/community";
import { notifyPriceDrops, recordPriceSnapshot } from "@/application/prices";
import { notifyTradeMatches } from "@/application/trades";
import { syncScryfallCatalog } from "@/application/sync-scryfall";
import { syncOracleTags } from "@/application/sync-otags";
import { OTAGS } from "@/domain/roles/otags";
import { createContainer } from "@/server/container";
import { existsSync } from "node:fs";
import path from "node:path";
import { pruneOldData } from "@/adapters/db/prune";

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
  // Etiquetas de Tagger (segunda fuente de roles): solo las que tienen más de una semana. Si
  // Scryfall falla se avisa y se siguen usando las de antes; no para el resto del sync.
  const tags = await syncOracleTags(OTAGS, { source: c.tagger, writer: c.cards });
  for (const t of tags) {
    if (t.status === "failed") console.warn(`  otag:${t.tag}: no se pudo actualizar (${t.error})`);
  }
  console.log(
    `Etiquetas de Tagger: ${tags.filter((t) => t.status === "synced").length} actualizadas, ` +
      `${tags.filter((t) => t.status === "fresh").length} al día, ` +
      `${tags.filter((t) => t.status === "failed").length} con error.`,
  );
  // Nombres y textos en otros idiomas (buscar en cualquier idioma): si falla, se avisa y se
  // siguen usando los de antes.
  if (!process.argv.includes("--skip-localized")) {
    // La descarga es larga: sin el tope de 20 s por petición del cliente normal.
    const bulkHttp = new HttpClient({
      userAgent: c.env.HTTP_USER_AGENT,
      minIntervalMs: c.env.SCRYFALL_MIN_INTERVAL_MS,
      timeoutMs: 60 * 60_000,
    });
    try {
      const loc = await syncLocalizations(
        {
          updatedAt: async () => (await bulkEntry(c.scryfallHttp, "all_cards")).updatedAt,
          read: async function* () {
            const { url } = await bulkEntry(c.scryfallHttp, "all_cards");
            for await (const raw of streamJsonLinesGz(bulkHttp, url)) {
              yield toLocalizedRecord(raw);
            }
          },
        },
        c.cards,
        {
          force: process.argv.includes("--force-localized"),
          onProgress: (msg) => process.stdout.write(`\r  Otros idiomas: ${msg}      `),
        },
      );
      console.log(
        loc.status === "fresh"
          ? `Otros idiomas: al día (${loc.rows} textos).`
          : `\nOtros idiomas: ${loc.rows} textos y ${loc.aliases} nombres de habilidades.`,
      );
    } catch (err) {
      console.warn(
        `Otros idiomas: no se pudieron actualizar (${err instanceof Error ? err.message : String(err)}).`,
      );
    }
  }
  const snapshot = await recordPriceSnapshot({ prices: c.prices });
  console.log(
    `Precios del ${snapshot.date}: ${snapshot.cards} cartas de colecciones y mazos, ${snapshot.printings} impresiones de colecciones.`,
  );
  const alerts = await notifyPriceDrops({
    prices: c.prices,
    profiles: c.social,
    notifications: c.social,
    cards: c.cards,
    collectionFor: (id) => c.collectionFor(id),
    decksFor: (id) => c.decksFor(id),
  });
  console.log(`Avisos de bajada de precio: ${alerts}.`);
  const trades = await notifyTradeMatches({
    cards: c.cards,
    collectionFor: (id) => c.collectionFor(id),
    decksFor: (id) => c.decksFor(id),
    tradesFor: (id) => c.tradesFor(id),
    profiles: c.social,
    follows: c.social,
    notifications: c.social,
  });
  console.log(`Avisos de cruces de intercambio: ${trades}.`);
  // La lista de game changers puede cambiar: se recalcula el bracket de todos los mazos.
  const facts = await refreshDeckFacts(
    { publicDecks: c.publicDecks, cards: c.cards },
    { all: true },
  );
  console.log(`Bracket e identidad recalculados en ${facts} mazos.`);
  const pruned = await pruneOldData(c.db);
  console.log(
    `Limpieza: ${pruned.cache} entradas de caché, ${pruned.notifications} avisos y ${pruned.prices} precios antiguos.`,
  );
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
