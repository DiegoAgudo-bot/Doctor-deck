/**
 * Copia de seguridad de la base de datos (en caliente, comprobada y comprimida) en
 * `data/backups/`, guardando las últimas BACKUP_KEEP (14 por defecto).
 * Si están las variables BACKUP_S3_* y BACKUP_PASSPHRASE, además la cifra y la sube a un
 * almacenamiento externo (14 días que se van pisando; ver DEPLOY.md).
 * Uso: npm run db:backup   ·   En el VPS lo lanza el cron que instala scripts/deploy.sh.
 * Restaurar: ver DEPLOY.md.
 */
import "dotenv/config";
import path from "node:path";
import { rmSync } from "node:fs";
import { backupDatabase } from "@/adapters/db/backup";
import { encryptFile, offsiteConfig, offsiteKey, putObject } from "@/adapters/db/offsite-backup";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/deck-doctor.db";
  const dbFile = url.replace(/^file:/, "");
  const dir = process.env.BACKUP_DIR ?? path.join(path.dirname(dbFile), "backups");
  const keep = Number(process.env.BACKUP_KEEP ?? 14);
  const r = await backupDatabase({
    dbFile,
    dir,
    keep: Number.isInteger(keep) && keep > 0 ? keep : 14,
  });
  console.log(
    `Copia: ${r.file} (${(r.bytes / 1024 / 1024).toFixed(1)} MB)` +
      (r.deleted.length > 0 ? ` · borradas ${r.deleted.length} antiguas` : ""),
  );

  const offsite = offsiteConfig(process.env);
  if (!offsite) {
    console.log("Sin copia externa (faltan BACKUP_S3_* o BACKUP_PASSPHRASE).");
    return;
  }
  const enc = `${r.file}.enc`;
  try {
    await encryptFile(r.file, enc, offsite.passphrase);
    const key = offsiteKey(new Date(), offsite.prefix);
    await putObject(offsite.target, key, enc);
    console.log(`Copia externa cifrada: ${offsite.target.bucket}/${key}`);
  } finally {
    rmSync(enc, { force: true });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
