-- CreateEnum
CREATE TYPE "HandicapperPlan" AS ENUM ('FREE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "HandicapperProfile" ADD COLUMN     "plan" "HandicapperPlan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "planInterval" "BillingInterval",
ADD COLUMN     "planStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "planStripeCustomerId" TEXT,
ADD COLUMN     "planStripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HandicapperProfile_planStripeCustomerId_key" ON "HandicapperProfile"("planStripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "HandicapperProfile_planStripeSubscriptionId_key" ON "HandicapperProfile"("planStripeSubscriptionId");

