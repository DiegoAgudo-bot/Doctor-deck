/*
  Warnings:

  - Added the required column `line` to the `CollectionEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `layout` to the `OracleCard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameKey` to the `OracleCard` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CollectionEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scryfallId" TEXT,
    "oracleId" TEXT,
    "name" TEXT NOT NULL,
    "setCode" TEXT,
    "collectorNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "matchMethod" TEXT,
    "line" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CollectionEntry" ("collectorNumber", "foil", "id", "importedAt", "name", "oracleId", "quantity", "raw", "scryfallId", "setCode", "status") SELECT "collectorNumber", "foil", "id", "importedAt", "name", "oracleId", "quantity", "raw", "scryfallId", "setCode", "status" FROM "CollectionEntry";
DROP TABLE "CollectionEntry";
ALTER TABLE "new_CollectionEntry" RENAME TO "CollectionEntry";
CREATE INDEX "CollectionEntry_oracleId_idx" ON "CollectionEntry"("oracleId");
CREATE TABLE "new_OracleCard" (
    "oracleId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "frontFaceName" TEXT,
    "frontFaceKey" TEXT,
    "layout" TEXT NOT NULL,
    "manaCost" TEXT,
    "cmc" REAL NOT NULL,
    "typeLine" TEXT NOT NULL,
    "oracleText" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "colorIdentity" TEXT NOT NULL,
    "legalCommander" BOOLEAN NOT NULL,
    "isBasicLand" BOOLEAN NOT NULL DEFAULT false,
    "edhrecRank" INTEGER,
    "imageUrl" TEXT
);
INSERT INTO "new_OracleCard" ("cmc", "colorIdentity", "edhrecRank", "frontFaceName", "isBasicLand", "legalCommander", "manaCost", "name", "oracleId", "oracleText", "typeLine") SELECT "cmc", "colorIdentity", "edhrecRank", "frontFaceName", "isBasicLand", "legalCommander", "manaCost", "name", "oracleId", "oracleText", "typeLine" FROM "OracleCard";
DROP TABLE "OracleCard";
ALTER TABLE "new_OracleCard" RENAME TO "OracleCard";
CREATE INDEX "OracleCard_nameKey_idx" ON "OracleCard"("nameKey");
CREATE INDEX "OracleCard_frontFaceKey_idx" ON "OracleCard"("frontFaceKey");
CREATE TABLE "new_Printing" (
    "scryfallId" TEXT NOT NULL PRIMARY KEY,
    "oracleId" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "collectorNumber" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "imageUrl" TEXT,
    CONSTRAINT "Printing_oracleId_fkey" FOREIGN KEY ("oracleId") REFERENCES "OracleCard" ("oracleId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Printing" ("collectorNumber", "imageUrl", "lang", "oracleId", "scryfallId", "setCode") SELECT "collectorNumber", "imageUrl", "lang", "oracleId", "scryfallId", "setCode" FROM "Printing";
DROP TABLE "Printing";
ALTER TABLE "new_Printing" RENAME TO "Printing";
CREATE INDEX "Printing_oracleId_idx" ON "Printing"("oracleId");
CREATE INDEX "Printing_setCode_collectorNumber_idx" ON "Printing"("setCode", "collectorNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
