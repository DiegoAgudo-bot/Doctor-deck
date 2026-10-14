-- Historial de versiones de los mazos.
CREATE TABLE "DeckVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "input" TEXT NOT NULL,
    "cards" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeckVersion_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeckVersion_publicId_key" ON "DeckVersion"("publicId");
CREATE INDEX "DeckVersion_deckId_createdAt_idx" ON "DeckVersion"("deckId", "createdAt");
