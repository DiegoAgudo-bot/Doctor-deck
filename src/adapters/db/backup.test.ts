import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { backupDatabase, backupName, backupsToDelete } from "./backup";

const dir = mkdtempSync(path.join(tmpdir(), "deck-doctor-backup-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("copias de seguridad", () => {
  it("nombre ordenable por fecha y rotación de las más antiguas", () => {
    expect(backupName(new Date("2026-10-11T03:15:59Z"))).toBe("deck-doctor-2026-10-11T0315.db.gz");
    const names = [
      "deck-doctor-2026-10-09T0315.db.gz",
      "deck-doctor-2026-10-11T0315.db.gz",
      "deck-doctor-2026-10-10T0315.db.gz",
      "otra-cosa.txt",
    ];
    expect(backupsToDelete(names, 2)).toEqual(["deck-doctor-2026-10-09T0315.db.gz"]);
    expect(backupsToDelete(names, 5)).toEqual([]);
  });

  it("copia la base en caliente, comprimida y legible, y borra las que sobran", async () => {
    const dbFile = path.join(dir, "live.db");
    const live = new Database(dbFile);
    live.exec("CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('hola')");
    const out = path.join(dir, "backups");
    // Dos copias viejas: con keep = 2 se queda la más reciente de ellas y la nueva.
    await backupDatabase({ dbFile, dir: out, keep: 2, now: new Date("2026-10-01T03:00:00Z") });
    await backupDatabase({ dbFile, dir: out, keep: 2, now: new Date("2026-10-02T03:00:00Z") });
    writeFileSync(path.join(out, "notas.txt"), "no se toca");
    const r = await backupDatabase({
      dbFile,
      dir: out,
      keep: 2,
      now: new Date("2026-10-03T03:00:00Z"),
    });
    live.close();

    expect(r.deleted).toEqual(["deck-doctor-2026-10-01T0300.db.gz"]);
    expect(readdirSync(out).sort()).toEqual([
      "deck-doctor-2026-10-02T0300.db.gz",
      "deck-doctor-2026-10-03T0300.db.gz",
      "notas.txt",
    ]);
    const restored = path.join(dir, "restored.db");
    writeFileSync(restored, gunzipSync(readFileSync(r.file)));
    const db = new Database(restored, { readonly: true });
    expect(db.prepare("SELECT x FROM t").get()).toEqual({ x: "hola" });
    db.close();
  });
});
