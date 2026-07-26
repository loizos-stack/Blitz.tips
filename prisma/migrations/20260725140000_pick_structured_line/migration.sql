-- Structured form of a handicapper pick's line, captured from the odds board so
-- the settler can grade period markets and player props without parsing the
-- display string. Null for manual picks, which keep the existing grading path.
ALTER TABLE "Pick" ADD COLUMN "marketKey"  TEXT;
ALTER TABLE "Pick" ADD COLUMN "side"       TEXT;
ALTER TABLE "Pick" ADD COLUMN "linePoint"  DOUBLE PRECISION;
ALTER TABLE "Pick" ADD COLUMN "playerName" TEXT;

-- Matches the contest-pick index; speeds up the auto-settle sweep.
CREATE INDEX IF NOT EXISTS "Pick_result_eventStartsAt_idx" ON "Pick"("result", "eventStartsAt");
