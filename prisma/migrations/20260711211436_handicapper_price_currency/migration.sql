-- CreateEnum
CREATE TYPE "PriceCurrency" AS ENUM ('USD', 'EUR', 'GBP');

-- AlterTable
ALTER TABLE "HandicapperProfile" ADD COLUMN     "priceCurrency" "PriceCurrency" NOT NULL DEFAULT 'USD';
