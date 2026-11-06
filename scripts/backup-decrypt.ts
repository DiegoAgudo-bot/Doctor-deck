/**
 * Descifra una copia externa (la que sube `db:backup` al almacenamiento) para restaurarla.
 * Uso: BACKUP_PASSPHRASE="…" npm run db:decrypt -- deck-doctor-d03.db.gz.enc copia.db.gz
 * Después, como cualquier copia: ver "Restaurar una copia" en DEPLOY.md.
 */
import "dotenv/config";
import { decryptFile } from "@/adapters/db/offsite-backup";

async function main() {
  const [src, dest] = process.argv.slice(2);
  const passphrase = process.env.BACKUP_PASSPHRASE;
  if (!src || !dest) throw new Error("Uso: npm run db:decrypt -- <copia.enc> <salida.db.gz>");
  if (!passphrase) throw new Error("Falta BACKUP_PASSPHRASE (en .env o delante del comando).");
  await decryptFile(src, dest, passphrase);
  console.log(`Descifrada en ${dest}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
