-- DropIndex
DROP INDEX "CollectionEntry_userId_idx";

-- CreateIndex
CREATE INDEX "CollectionEntry_userId_oracleId_idx" ON "CollectionEntry"("userId", "oracleId");

-- CreateIndex
CREATE INDEX "DeckCard_oracleId_idx" ON "DeckCard"("oracleId");

