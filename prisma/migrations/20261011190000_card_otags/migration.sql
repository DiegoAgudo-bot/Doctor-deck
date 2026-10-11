-- CreateTable
CREATE TABLE "CardOtag" (
    "oracleId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    PRIMARY KEY ("oracleId", "tag")
);

-- CreateTable
CREATE TABLE "OtagSync" (
    "tag" TEXT NOT NULL PRIMARY KEY,
    "syncedAt" DATETIME NOT NULL,
    "cards" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "CardOtag_tag_idx" ON "CardOtag"("tag");
