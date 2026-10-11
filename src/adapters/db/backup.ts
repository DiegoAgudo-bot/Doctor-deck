import Database from "better-sqlite3";
import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

/** `deck-doctor-2026-10-11T0315.db.gz`: se ordenan por nombre = por fecha. */
const NAME = /^deck-doctor-\d{4}-\d{2}-\d{2}T\d{4}\.db\.gz$/;

export const backupName = (now: Date) =>
  `deck-doctor-${now.toISOString().slice(0, 16).replace(":", "")}.db.gz`;

/** Copias que sobran: de las que siguen el formato, todas menos las `keep` más recientes. */
export function backupsToDelete(names: readonly string[], keep: number): string[] {
  const ours = names.filter((n) => NAME.test(n)).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}

export interface BackupResult {
  file: string;
  bytes: number;
  deleted: string[];
}

/**
 * Copia de seguridad en caliente de la SQLite (API `backup` de SQLite: consistente aunque la web
 * esté escribiendo), comprueba la copia con `integrity_check`, la comprime y borra las antiguas.
 */
export async function backupDatabase(opts: {
  dbFile: string;
  dir: string;
  keep: number;
  now?: Date;
}): Promise<BackupResult> {
  mkdirSync(opts.dir, { recursive: true });
  const name = backupName(opts.now ?? new Date());
  const tmp = path.join(opts.dir, name.replace(/\.gz$/, ".tmp"));
  const file = path.join(opts.dir, name);

  const source = new Database(opts.dbFile, { readonly: true, fileMustExist: true });
  try {
    await source.backup(tmp);
  } finally {
    source.close();
  }
  try {
    const copy = new Database(tmp, { readonly: true });
    const check = copy.pragma("integrity_check", { simple: true });
    copy.close();
    if (check !== "ok") throw new Error(`La copia no está sana: ${String(check)}`);
    await pipeline(createReadStream(tmp), createGzip({ level: 9 }), createWriteStream(file));
  } finally {
    rmSync(tmp, { force: true });
  }

  const deleted = backupsToDelete(readdirSync(opts.dir), opts.keep);
  for (const d of deleted) rmSync(path.join(opts.dir, d), { force: true });
  return { file, bytes: statSync(file).size, deleted };
}
