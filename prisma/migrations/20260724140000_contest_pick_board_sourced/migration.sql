-- Contest picks are taken from our odds board, so they carry the bet type (for
-- grading) and always reference the upstream event (for auto-settlement).
ALTER TABLE "ContestPick" ADD COLUMN "betType" "BetType" NOT NULL DEFAULT 'MONEYLINE';

-- Speeds up the auto-settle sweep, which scans pending picks whose game started.
CREATE INDEX IF NOT EXISTS "ContestPick_result_eventStartsAt_idx"
  ON "ContestPick"("result", "eventStartsAt");
