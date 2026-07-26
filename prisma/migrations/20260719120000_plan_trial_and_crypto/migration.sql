-- AlterTable
ALTER TABLE "HandicapperProfile" ADD COLUMN "planTrialUsed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlanCryptoPayment" (
    "id" TEXT NOT NULL,
    "chargeCode" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "plan" "HandicapperPlan" NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CryptoPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanCryptoPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanCryptoPayment_chargeCode_key" ON "PlanCryptoPayment"("chargeCode");

-- CreateIndex
CREATE INDEX "PlanCryptoPayment_handicapperId_status_idx" ON "PlanCryptoPayment"("handicapperId", "status");
