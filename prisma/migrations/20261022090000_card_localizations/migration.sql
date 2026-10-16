-- CreateTable
CREATE TABLE "CardLocalization" (
    "oracleId" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "typeLine" TEXT,
    "text" TEXT,

    PRIMARY KEY ("oracleId", "lang")
);

-- CreateTable
CREATE TABLE "KeywordAlias" (
    "keyword" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasKey" TEXT NOT NULL,
    "votes" INTEGER NOT NULL,

    PRIMARY KEY ("keyword", "lang", "aliasKey")
);

-- CreateTable
CREATE TABLE "LocalizationSync" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "syncedAt" DATETIME NOT NULL,
    "bulkUpdatedAt" TEXT NOT NULL,
    "rows" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "CardLocalization_nameKey_idx" ON "CardLocalization"("nameKey");
