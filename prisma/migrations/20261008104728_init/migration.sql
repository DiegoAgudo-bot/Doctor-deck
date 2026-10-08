-- CreateTable
CREATE TABLE "OracleCard" (
    "oracleId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "frontFaceName" TEXT,
    "manaCost" TEXT,
    "cmc" REAL NOT NULL,
    "typeLine" TEXT NOT NULL,
    "oracleText" TEXT,
    "colorIdentity" TEXT NOT NULL,
    "legalCommander" BOOLEAN NOT NULL,
    "isBasicLand" BOOLEAN NOT NULL DEFAULT false,
    "edhrecRank" INTEGER
);

-- CreateTable
CREATE TABLE "Printing" (
    "scryfallId" TEXT NOT NULL PRIMARY KEY,
    "oracleId" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "collectorNumber" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "imageUrl" TEXT,
    CONSTRAINT "Printing_oracleId_fkey" FOREIGN KEY ("oracleId") REFERENCES "OracleCard" ("oracleId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scryfallId" TEXT,
    "oracleId" TEXT,
    "name" TEXT NOT NULL,
    "setCode" TEXT,
    "collectorNumber" TEXT,
    "quantity" INTEGER NOT NULL,
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deckId" INTEGER NOT NULL,
    "oracleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isCommander" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SwapDecision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deckId" INTEGER NOT NULL,
    "outOracleId" TEXT NOT NULL,
    "inOracleId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SwapDecision_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HttpCache" (
    "url" TEXT NOT NULL PRIMARY KEY,
    "status" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "OracleCard_name_idx" ON "OracleCard"("name");

-- CreateIndex
CREATE INDEX "OracleCard_frontFaceName_idx" ON "OracleCard"("frontFaceName");

-- CreateIndex
CREATE INDEX "Printing_oracleId_idx" ON "Printing"("oracleId");

-- CreateIndex
CREATE INDEX "Printing_setCode_collectorNumber_idx" ON "Printing"("setCode", "collectorNumber");

-- CreateIndex
CREATE INDEX "CollectionEntry_oracleId_idx" ON "CollectionEntry"("oracleId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckCard_deckId_oracleId_key" ON "DeckCard"("deckId", "oracleId");

-- CreateIndex
CREATE UNIQUE INDEX "SwapDecision_deckId_outOracleId_inOracleId_key" ON "SwapDecision"("deckId", "outOracleId", "inOracleId");
