-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "prevPrice" REAL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "priceAlertPercent" INTEGER DEFAULT 15;

-- CreateIndex
CREATE INDEX "Notification_userId_type_cardId_idx" ON "Notification"("userId", "type", "cardId");

