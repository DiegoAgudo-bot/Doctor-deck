-- CreateTable
CREATE TABLE "PlayGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "userId"),
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PlayGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "groupId" INTEGER,
    "createdById" TEXT NOT NULL,
    "playedAt" DATETIME NOT NULL,
    "turns" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Game_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PlayGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameId" INTEGER NOT NULL,
    "seat" INTEGER NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "deckId" INTEGER,
    "deckName" TEXT NOT NULL DEFAULT '',
    "commanderNames" TEXT NOT NULL DEFAULT '',
    "winner" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "borrowerId" TEXT,
    "borrowerName" TEXT,
    "oracleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" DATETIME,
    CONSTRAINT "Loan_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeckComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "deckId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hiddenAt" DATETIME,
    CONSTRAINT "DeckComment_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeckComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("blockerId", "blockedId"),
    CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentReport" (
    "commentId" INTEGER NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,

    PRIMARY KEY ("commentId", "reporterId"),
    CONSTRAINT "CommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DeckComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "refId" TEXT;

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "commentsOpen" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "PlayGroup_publicId_key" ON "PlayGroup"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayGroup_inviteCode_key" ON "PlayGroup"("inviteCode");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_publicId_key" ON "Game"("publicId");

-- CreateIndex
CREATE INDEX "Game_groupId_playedAt_idx" ON "Game"("groupId", "playedAt");

-- CreateIndex
CREATE INDEX "Game_createdById_idx" ON "Game"("createdById");

-- CreateIndex
CREATE INDEX "GamePlayer_gameId_idx" ON "GamePlayer"("gameId");

-- CreateIndex
CREATE INDEX "GamePlayer_userId_idx" ON "GamePlayer"("userId");

-- CreateIndex
CREATE INDEX "GamePlayer_deckId_idx" ON "GamePlayer"("deckId");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_publicId_key" ON "Loan"("publicId");

-- CreateIndex
CREATE INDEX "Loan_lenderId_returnedAt_idx" ON "Loan"("lenderId", "returnedAt");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_returnedAt_idx" ON "Loan"("borrowerId", "returnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeckComment_publicId_key" ON "DeckComment"("publicId");

-- CreateIndex
CREATE INDEX "DeckComment_deckId_createdAt_idx" ON "DeckComment"("deckId", "createdAt");

-- CreateIndex
CREATE INDEX "DeckComment_authorId_createdAt_idx" ON "DeckComment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

