-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "imageUrl" TEXT,
    "gameChanger" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_OracleCard" ("cmc", "colorIdentity", "edhrecRank", "frontFaceKey", "frontFaceName", "imageUrl", "isBasicLand", "keywords", "layout", "legalCommander", "manaCost", "name", "nameKey", "oracleId", "oracleText", "typeLine") SELECT "cmc", "colorIdentity", "edhrecRank", "frontFaceKey", "frontFaceName", "imageUrl", "isBasicLand", "keywords", "layout", "legalCommander", "manaCost", "name", "nameKey", "oracleId", "oracleText", "typeLine" FROM "OracleCard";
DROP TABLE "OracleCard";
ALTER TABLE "new_OracleCard" RENAME TO "OracleCard";
CREATE INDEX "OracleCard_nameKey_idx" ON "OracleCard"("nameKey");
CREATE INDEX "OracleCard_frontFaceKey_idx" ON "OracleCard"("frontFaceKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

