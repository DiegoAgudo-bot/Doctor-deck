import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createDb, type Db } from "@/adapters/db/prisma";

const MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations");

/** BD SQLite temporal con todas las migraciones aplicadas. Llama a `cleanup()` al terminar. */
export function createTestDb(): { db: Db; cleanup: () => Promise<void> } {
  const dir = mkdtempSync(path.join(tmpdir(), "deck-doctor-db-"));
  const file = path.join(dir, "test.db");
  const raw = new Database(file);
  for (const m of readdirSync(MIGRATIONS)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    raw.exec(readFileSync(path.join(MIGRATIONS, m, "migration.sql"), "utf8"));
  }
  raw.close();
  const db = createDb(`file:${file}`);
  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Crea un usuario mínimo (las filas de colección y mazos lo necesitan por la clave foránea). */
export async function createTestUser(db: Db, id = "user-1"): Promise<string> {
  await db.user.create({ data: { id, name: id, email: `${id}@test.local` } });
  return id;
}
