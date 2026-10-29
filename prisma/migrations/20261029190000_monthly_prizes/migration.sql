-- Monthly handicapper prize: one frozen row per paid place, per month.
--
-- See the model comment in schema.prisma for why the result is stored rather
-- than recomputed. Additive: a new table only, nothing existing is touched.

-- CreateTable
CREATE TABLE "MonthlyPrizeAward" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "prizeCents" INTEGER NOT NULL,
    "unitsNet" DOUBLE PRECISION NOT NULL,
    "record" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPrizeAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One winner per place per month: what makes recording a month idempotent.
CREATE UNIQUE INDEX "MonthlyPrizeAward_month_rank_key" ON "MonthlyPrizeAward"("month", "rank");

-- CreateIndex
CREATE INDEX "MonthlyPrizeAward_handicapperId_idx" ON "MonthlyPrizeAward"("handicapperId");

-- AddForeignKey
ALTER TABLE "MonthlyPrizeAward" ADD CONSTRAINT "MonthlyPrizeAward_handicapperId_fkey" FOREIGN KEY ("handicapperId") REFERENCES "HandicapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
