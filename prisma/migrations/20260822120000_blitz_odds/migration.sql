-- Blitz Odds: line-movement watcher.
--
-- Note: `prisma migrate diff` also proposed dropping three indexes on Pick and
-- User. That is pre-existing drift between the migration history and
-- schema.prisma, unrelated to this feature, and dropping live indexes as a side
-- effect of an unrelated migration is how a query gets slow months later. They
-- are deliberately left in place; resolve that drift on its own terms.




-- CreateTable
CREATE TABLE "OddsSnapshot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "point" DOUBLE PRECISION,
    "bookmaker" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "minutesToStart" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsDrop" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "sport" "PickSport" NOT NULL,
    "matchup" TEXT NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "marketKey" TEXT NOT NULL,
    "marketLabel" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "point" DOUBLE PRECISION,
    "bookCount" INTEGER NOT NULL,
    "books" TEXT NOT NULL,
    "openPrice" INTEGER NOT NULL,
    "currentPrice" INTEGER NOT NULL,
    "probDelta" DOUBLE PRECISION NOT NULL,
    "baselineMinutes" INTEGER NOT NULL,
    "minutesToStart" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OddsDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsWatchSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "pollMinutes" INTEGER NOT NULL DEFAULT 5,
    "baselineFromMinutes" INTEGER NOT NULL DEFAULT 30,
    "baselineToMinutes" INTEGER NOT NULL DEFAULT 16,
    "alertWithinMinutes" INTEGER NOT NULL DEFAULT 15,
    "bookmakers" TEXT NOT NULL DEFAULT 'bet365,betano',
    "minProbDelta" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "minBooks" INTEGER NOT NULL DEFAULT 2,
    "watchGameLines" BOOLEAN NOT NULL DEFAULT true,
    "watchAlternates" BOOLEAN NOT NULL DEFAULT false,
    "watchProps" BOOLEAN NOT NULL DEFAULT false,
    "watchSoccerExtras" BOOLEAN NOT NULL DEFAULT false,
    "dailyCreditCap" INTEGER NOT NULL DEFAULT 2000,
    "maxDeepEvents" INTEGER NOT NULL DEFAULT 20,
    "sportKeys" TEXT NOT NULL DEFAULT '',
    "leaguesJson" TEXT NOT NULL DEFAULT '',
    "leaguesAt" TIMESTAMP(3),
    "notifyOnSite" BOOLEAN NOT NULL DEFAULT true,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT true,
    "telegramChatId" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsWatchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OddsPollRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "credits" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "eventsSeen" INTEGER NOT NULL DEFAULT 0,
    "dropsFound" INTEGER NOT NULL DEFAULT 0,
    "booksSeen" TEXT NOT NULL DEFAULT '',
    "stoppedReason" TEXT,
    "error" TEXT,

    CONSTRAINT "OddsPollRun_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "OddsSnapshot_eventId_marketKey_selection_point_capturedAt_idx" ON "OddsSnapshot"("eventId", "marketKey", "selection", "point", "capturedAt");

-- CreateIndex
CREATE INDEX "OddsSnapshot_capturedAt_idx" ON "OddsSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "OddsDrop_detectedAt_idx" ON "OddsDrop"("detectedAt");

-- CreateIndex
CREATE INDEX "OddsDrop_eventId_marketKey_selection_point_idx" ON "OddsDrop"("eventId", "marketKey", "selection", "point");

-- CreateIndex
CREATE INDEX "OddsPollRun_startedAt_idx" ON "OddsPollRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OddsFixture_eventId_key" ON "OddsFixture"("eventId");

-- CreateIndex
CREATE INDEX "OddsFixture_commenceTime_idx" ON "OddsFixture"("commenceTime");

-- CreateIndex
CREATE INDEX "OddsFixture_sportKey_commenceTime_idx" ON "OddsFixture"("sportKey", "commenceTime");

