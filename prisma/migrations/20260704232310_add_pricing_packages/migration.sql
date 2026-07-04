-- AlterTable
ALTER TABLE "HandicapperProfile" ADD COLUMN     "annualPriceCents" INTEGER,
ADD COLUMN     "stripeAnnualPriceId" TEXT,
ADD COLUMN     "stripeWeeklyPriceId" TEXT,
ADD COLUMN     "weeklyPriceCents" INTEGER;

