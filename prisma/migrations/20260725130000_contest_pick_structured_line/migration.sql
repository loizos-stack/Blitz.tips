-- Capture the structured form of a contest pick's line at submission time, so
-- grading (period markets, player props) never has to re-parse the display
-- string. Populated from the verified board option.
ALTER TABLE "ContestPick" ADD COLUMN "marketKey"  TEXT;
ALTER TABLE "ContestPick" ADD COLUMN "side"       TEXT;
ALTER TABLE "ContestPick" ADD COLUMN "linePoint"  DOUBLE PRECISION;
ALTER TABLE "ContestPick" ADD COLUMN "playerName" TEXT;
