-- CreateEnum
CREATE TYPE "CryptoPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingIntervalPass" AS ENUM ('WEEKLY', 'MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "CryptoPayment" (
    "id" TEXT NOT NULL,
    "chargeCode" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "interval" "BillingIntervalPass" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "status" "CryptoPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoPayment_chargeCode_key" ON "CryptoPayment"("chargeCode");

-- CreateIndex
CREATE INDEX "CryptoPayment_handicapperId_status_idx" ON "CryptoPayment"("handicapperId", "status");

-- CreateIndex
CREATE INDEX "CryptoPayment_subscriberId_idx" ON "CryptoPayment"("subscriberId");
