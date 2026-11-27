-- Blitz Odds: the final-30-minute window, and bet365/betano.
--
-- This exists as its own migration because the previous one had ALREADY been
-- applied in production when its content changed. `prisma migrate deploy`
-- matches migrations by name only — it reported "No pending migrations to
-- apply", ignored the rewritten file without any error, and the build passed
-- while the database stayed on the old shape. The deployed code then queried
-- columns that were never created.
--
-- Hence the rule this migration exists to respect: an applied migration is
-- immutable. Changes go in a new file, always.




-- AlterTable
-- Added with a default and then stripped of it, so the statement cannot fail on
-- a table that turns out to hold rows. These tables should be empty — the
-- watcher has never run — but a migration that fails blocks every future deploy,
-- which is far worse than a column that briefly had a default.
ALTER TABLE "OddsDrop" ADD COLUMN     "baselineMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OddsDrop" ALTER COLUMN "baselineMinutes" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OddsPollRun" ADD COLUMN     "booksSeen" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "OddsSnapshot" ADD COLUMN     "minutesToStart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OddsSnapshot" ALTER COLUMN "minutesToStart" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OddsWatchSettings" DROP COLUMN "cutoffMinutes",
DROP COLUMN "leadHours",
ADD COLUMN     "alertWithinMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "baselineFromMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "baselineToMinutes" INTEGER NOT NULL DEFAULT 16,
ADD COLUMN     "bookmakers" TEXT NOT NULL DEFAULT 'bet365,betano',
ALTER COLUMN "pollMinutes" SET DEFAULT 5;

-- CreateTable
CREATE TABLE "OddsFixture" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "sport" "PickSport" NOT NULL,
    "matchup" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsFixture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OddsFixture_eventId_key" ON "OddsFixture"("eventId");

-- CreateIndex
CREATE INDEX "OddsFixture_commenceTime_idx" ON "OddsFixture"("commenceTime");

-- CreateIndex
CREATE INDEX "OddsFixture_sportKey_commenceTime_idx" ON "OddsFixture"("sportKey", "commenceTime");

