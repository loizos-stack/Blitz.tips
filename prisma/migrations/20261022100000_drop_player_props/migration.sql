-- Remove the Player Props watcher.
--
-- The feature is gone from the codebase; these five tables were the only state
-- it kept. Nothing else in the schema references them — they carried no
-- foreign keys — so dropping them is self-contained. Their indexes go with
-- them automatically.
--
-- What is lost: prop price snapshots (pruned within the hour by design
-- anyway), the opening-line baselines, the alerts raised, and the poll run
-- log. The watcher was never switched on in production — every scheduled
-- cycle returned "Watcher is switched off" and spent zero credits — so these
-- tables are expected to be empty.
DROP TABLE IF EXISTS "PropSnapshot";
DROP TABLE IF EXISTS "PropSignal";
DROP TABLE IF EXISTS "PropOpeningLine";
DROP TABLE IF EXISTS "PropPollRun";
DROP TABLE IF EXISTS "PropWatchSettings";
