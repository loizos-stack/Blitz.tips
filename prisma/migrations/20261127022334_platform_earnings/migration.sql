-- CreateTable
CREATE TABLE "PlatformEarning" (
    "id" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "subscriberId" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "interval" "BillingIntervalPass" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "PriceCurrency" NOT NULL DEFAULT 'USD',
    "commissionCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformEarning_stripeInvoiceId_key" ON "PlatformEarning"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "PlatformEarning_handicapperId_idx" ON "PlatformEarning"("handicapperId");

-- CreateIndex
CREATE INDEX "PlatformEarning_subscriberId_idx" ON "PlatformEarning"("subscriberId");
