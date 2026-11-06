-- Blitz Odds: choose which feed the watcher reads.
--
-- Defaults to the existing provider so this migration changes no behaviour.
-- Rundown is opt-in from the panel, because its field mapping has never met a
-- live response — see lib/blitz-odds-rundown and scripts/probe-rundown.mjs.




-- AlterTable
ALTER TABLE "OddsWatchSettings" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'oddsapi';

