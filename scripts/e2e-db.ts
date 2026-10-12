/**
 * BD para las pruebas de navegador (`npm run e2e`): migraciones, el catálogo de ejemplo de
 * `tests/fixtures/scryfall` y las páginas de EDHREC de `tests/fixtures/edhrec` ya en caché, para
 * que la app funcione sin salir a internet. Sin imágenes (se ve el hueco con el nombre).
 * Uso: tsx scripts/e2e-db.ts data/e2e.db
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaCardRepository } from "@/adapters/db/card-repository";
import { createDb } from "@/adapters/db/prisma";
import { EDHREC_JSON_BASE } from "@/adapters/edhrec/edhrec-client";
import { fixtureCards, fixturePrintings } from "../tests/helpers/scryfall-fixtures";

const EDHREC_PAGES: Record<string, string> = {
  "/commanders/teferi-temporal-archmage": "teferi-temporal-archmage.json",
  "/commanders/teferi-temporal-archmage/control": "teferi-temporal-archmage-control.json",
  "/average-decks/teferi-temporal-archmage": "average-deck-teferi.json",
};

async function main() {
  const file = path.resolve(process.argv[2] ?? "data/e2e.db");
  mkdirSync(path.dirname(file), { recursive: true });
  for (const f of [file, `${file}-wal`, `${file}-shm`]) rmSync(f, { force: true });
  const raw = new Database(file);
  const migrations = path.resolve("prisma/migrations");
  for (const m of readdirSync(migrations)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    raw.exec(readFileSync(path.join(migrations, m, "migration.sql"), "utf8"));
  }
  raw.close();

  const db = createDb(`file:${file}`);
  const cards = new PrismaCardRepository(db);
  await cards.insertCards(fixtureCards().map((c) => ({ ...c, imageUrl: null })));
  await cards.insertPrintings(fixturePrintings().map((p) => ({ ...p, imageUrl: null })));
  // Muy en el futuro: así no caducan durante la prueba.
  const fetchedAt = new Date(Date.now() + 365 * 24 * 3_600_000);
  for (const [page, fixture] of Object.entries(EDHREC_PAGES)) {
    await db.httpCache.create({
      data: {
        url: `${EDHREC_JSON_BASE}${page}.json`,
        status: 200,
        body: readFileSync(path.resolve("tests/fixtures/edhrec", fixture), "utf8"),
        fetchedAt,
      },
    });
  }
  await db.$disconnect();
  console.log(`BD de pruebas lista: ${file}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
