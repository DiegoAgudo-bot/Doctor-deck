-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "oracleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "eur" REAL NOT NULL,

    PRIMARY KEY ("oracleId", "date")
);

-- CreateIndex
CREATE INDEX "PriceSnapshot_date_idx" ON "PriceSnapshot"("date");

