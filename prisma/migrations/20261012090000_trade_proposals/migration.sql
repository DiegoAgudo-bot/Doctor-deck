-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "tradeId" TEXT;

-- CreateTable
CREATE TABLE "TradeProposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publicId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "turnUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastById" TEXT NOT NULL,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TradeProposal_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeProposal_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeProposalItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "giverId" TEXT NOT NULL,
    "oracleId" TEXT NOT NULL,
    "scryfallId" TEXT,
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL,
    CONSTRAINT "TradeProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TradeProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeProposal_publicId_key" ON "TradeProposal"("publicId");

-- CreateIndex
CREATE INDEX "TradeProposal_fromUserId_idx" ON "TradeProposal"("fromUserId");

-- CreateIndex
CREATE INDEX "TradeProposal_toUserId_idx" ON "TradeProposal"("toUserId");

-- CreateIndex
CREATE INDEX "TradeProposalItem_proposalId_version_idx" ON "TradeProposalItem"("proposalId", "version");

