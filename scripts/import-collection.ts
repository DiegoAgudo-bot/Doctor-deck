/**
 * Importa un CSV de ManaBox a la BD local y muestra el resumen.
 * Uso: npm run collection:import -- "ruta/al/export.csv"
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { importCollection } from "@/application/import-collection";
import { createContainer } from "@/server/container";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Uso: npm run collection:import -- "ruta/al/export.csv"');
  const c = createContainer();
  const s = await importCollection(await readFile(file, "utf8"), c);
  console.log(`Filas: ${s.rows} · copias: ${s.totalCards} · cartas distintas: ${s.uniqueCards}`);
  console.log(
    `Emparejadas: ${s.matchedRows} (id: ${s.matchedBy.scryfallId}, set+nº: ${s.matchedBy.setNumber}, nombre: ${s.matchedBy.name})`,
  );
  console.log(`Sin emparejar: ${s.unmatched.length}`);
  const MAX = 25;
  for (const r of s.unmatched.slice(0, MAX))
    console.log(`  línea ${r.line}: ${r.name} (${r.setCode ?? "?"} ${r.collectorNumber ?? ""})`);
  if (s.unmatched.length > MAX) console.log(`  … y ${s.unmatched.length - MAX} más`);
  for (const e of s.errors) console.log(`  error línea ${e.line}: ${e.reason}`);
  await c.db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
