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
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- isPublic (true/false) pasa a visibility (public/private); "unlisted" es nuevo.
INSERT INTO "new_Deck" ("commanderNames", "createdAt", "excluded", "id", "input", "name", "publicId", "source", "theme", "updatedAt", "userId", "visibility") SELECT "commanderNames", "createdAt", "excluded", "id", "input", "name", "publicId", "source", "theme", "updatedAt", "userId", CASE WHEN "isPublic" THEN 'public' ELSE 'private' END FROM "Deck";
DROP TABLE "Deck";
ALTER TABLE "new_Deck" RENAME TO "Deck";
CREATE UNIQUE INDEX "Deck_publicId_key" ON "Deck"("publicId");
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");
CREATE INDEX "Deck_visibility_createdAt_idx" ON "Deck"("visibility", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


