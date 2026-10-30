-- Player Props: correlated prop movement for a single player.
-- See the block comment above PropSnapshot in schema.prisma for what the
-- signal is and why direction is not filtered.

-- CreateTable
CREATE TABLE "PropSnapshot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "matchup" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "point" DOUBLE PRECISION,
    "bookmaker" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commenceTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropSignal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "matchup" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "marketCount" INTEGER NOT NULL,
    "bookCount" INTEGER NOT NULL,
    "books" TEXT NOT NULL,
    "markets" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "topProbDelta" DOUBLE PRECISION NOT NULL,
    "movesJson" TEXT NOT NULL,
    "minutesToStart" INTEGER NOT NULL,
    "commenceTime" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "PropSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropWatchSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sports" TEXT NOT NULL DEFAULT '',
    "windowMinutes" INTEGER NOT NULL DEFAULT 240,
    "clusterMinutes" INTEGER NOT NULL DEFAULT 10,
    "minProps" INTEGER NOT NULL DEFAULT 2,
    "minBooks" INTEGER NOT NULL DEFAULT 2,
    "minProbDelta" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "countLineMoves" BOOLEAN NOT NULL DEFAULT true,
    "dailyCreditCap" INTEGER NOT NULL DEFAULT 500,
    "maxEventsPerRun" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropWatchSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropPollRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "eventsSeen" INTEGER NOT NULL DEFAULT 0,
    "playersSeen" INTEGER NOT NULL DEFAULT 0,
    "signalsFound" INTEGER NOT NULL DEFAULT 0,
    "stoppedReason" TEXT,
    "error" TEXT,

    CONSTRAINT "PropPollRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropSnapshot_eventId_capturedAt_idx" ON "PropSnapshot"("eventId", "capturedAt");

-- CreateIndex
CREATE INDEX "PropSnapshot_capturedAt_idx" ON "PropSnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "PropSnapshot_eventId_player_marketKey_selection_bookmaker_idx" ON "PropSnapshot"("eventId", "player", "marketKey", "selection", "bookmaker");

-- CreateIndex
CREATE INDEX "PropSignal_detectedAt_idx" ON "PropSignal"("detectedAt");

-- CreateIndex
CREATE INDEX "PropSignal_acknowledgedAt_idx" ON "PropSignal"("acknowledgedAt");

-- CreateIndex
CREATE INDEX "PropSignal_eventId_player_detectedAt_idx" ON "PropSignal"("eventId", "player", "detectedAt");

-- CreateIndex
CREATE INDEX "PropPollRun_startedAt_idx" ON "PropPollRun"("startedAt");

