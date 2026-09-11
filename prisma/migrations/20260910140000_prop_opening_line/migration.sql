-- The first price this watcher saw for each player line, kept beyond the
-- snapshot pruning window so a move can be measured from where it opened.

-- CreateTable
CREATE TABLE "PropOpeningLine" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sportKey" TEXT NOT NULL,
    "matchup" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "marketKey" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "openPrice" INTEGER NOT NULL,
    "openPoint" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commenceTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropOpeningLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropOpeningLine_eventId_idx" ON "PropOpeningLine"("eventId");

-- CreateIndex
CREATE INDEX "PropOpeningLine_commenceTime_idx" ON "PropOpeningLine"("commenceTime");

-- CreateIndex
CREATE UNIQUE INDEX "PropOpeningLine_eventId_player_marketKey_selection_bookmake_key" ON "PropOpeningLine"("eventId", "player", "marketKey", "selection", "bookmaker");

