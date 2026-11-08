-- Off-platform payments: a subscriber pays the platform by bank transfer,
-- PayPal or similar, an admin confirms it, and the handicapper's share is
-- sent on by hand and recorded here too.

CREATE TYPE "DirectPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

CREATE TABLE "DirectPayment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "interval" "BillingIntervalPass" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "PriceCurrency" NOT NULL DEFAULT 'USD',
    "commissionCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "status" "DirectPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByEmail" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectPayment_reference_key" ON "DirectPayment"("reference");
CREATE INDEX "DirectPayment_status_createdAt_idx" ON "DirectPayment"("status", "createdAt");
CREATE INDEX "DirectPayment_handicapperId_status_idx" ON "DirectPayment"("handicapperId", "status");
CREATE INDEX "DirectPayment_subscriberId_idx" ON "DirectPayment"("subscriberId");

CREATE TABLE "HandicapperPayout" (
    "id" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "PriceCurrency" NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "recordedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandicapperPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HandicapperPayout_handicapperId_paidAt_idx" ON "HandicapperPayout"("handicapperId", "paidAt");
