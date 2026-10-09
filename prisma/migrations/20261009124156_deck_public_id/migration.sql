-- Identificador público de los mazos (uuid) para las URL /decks/{publicId}. Los mazos que ya
-- existían reciben un uuid v4 generado aquí.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "input" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'text',
    "commanderNames" TEXT NOT NULL DEFAULT '',
    "excluded" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Deck" ("commanderNames", "createdAt", "excluded", "id", "input", "name", "publicId", "source", "theme", "updatedAt", "userId") SELECT "commanderNames", "createdAt", "excluded", "id", "input", "name", lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), "source", "theme", "updatedAt", "userId" FROM "Deck";
DROP TABLE "Deck";
ALTER TABLE "new_Deck" RENAME TO "Deck";
CREATE UNIQUE INDEX "Deck_publicId_key" ON "Deck"("publicId");
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
