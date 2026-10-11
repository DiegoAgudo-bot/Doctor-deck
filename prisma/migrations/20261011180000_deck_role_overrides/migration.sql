-- CreateTable
CREATE TABLE "DeckRoleOverride" (
    "deckId" INTEGER NOT NULL,
    "oracleId" TEXT NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '[]',
    "primary" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("deckId", "oracleId"),
    CONSTRAINT "DeckRoleOverride_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
