-- Closing line value: the last price a selection was available at before
-- kickoff, plus when it was captured. Additive and nullable — existing picks
-- simply have no closing price and are excluded from CLV stats.
ALTER TABLE "Pick" ADD COLUMN "closingOdds" INTEGER;
ALTER TABLE "Pick" ADD COLUMN "closingOddsAt" TIMESTAMP(3);

-- The capture job looks for board-sourced picks whose game is about to start
-- and which don't have a closing price yet.
CREATE INDEX "Pick_closingOdds_eventStartsAt_idx" ON "Pick"("closingOdds", "eventStartsAt");
