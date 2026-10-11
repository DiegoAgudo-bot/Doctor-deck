-- Identificador público (uuid) de cada línea de la colección, para no sacar el id numérico en
-- las URL de la API (/api/collection/cards/{publicId}). Las filas que ya existían reciben un uuid v4.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CollectionEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "userId" TEXT,
    "scryfallId" TEXT,
    "oracleId" TEXT,
    "name" TEXT NOT NULL,
    "setCode" TEXT,
    "collectorNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "status" TEXT NOT NULL,
    "matchMethod" TEXT,
    "line" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollectionEntry" ("collectorNumber", "foil", "id", "importedAt", "language", "line", "matchMethod", "name", "oracleId", "publicId", "quantity", "raw", "scryfallId", "setCode", "status", "userId") SELECT "collectorNumber", "foil", "id", "importedAt", "language", "line", "matchMethod", "name", "oracleId", lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), "quantity", "raw", "scryfallId", "setCode", "status", "userId" FROM "CollectionEntry";
DROP TABLE "CollectionEntry";
ALTER TABLE "new_CollectionEntry" RENAME TO "CollectionEntry";
CREATE UNIQUE INDEX "CollectionEntry_publicId_key" ON "CollectionEntry"("publicId");
CREATE INDEX "CollectionEntry_oracleId_idx" ON "CollectionEntry"("oracleId");
CREATE INDEX "CollectionEntry_userId_idx" ON "CollectionEntry"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

