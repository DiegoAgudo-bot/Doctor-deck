-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "bracket" INTEGER;
ALTER TABLE "Deck" ADD COLUMN "colorIdentity" TEXT;

-- CreateTable
CREATE TABLE "DeckLike" (
    "userId" TEXT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "deckId"),
    CONSTRAINT "DeckLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeckLike_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeckLike_deckId_idx" ON "DeckLike"("deckId");

