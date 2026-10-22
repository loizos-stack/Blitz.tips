-- Blitz Odds: give the alert window a floor as well as a ceiling.
--
-- alertWithinMinutes meant "anything up to N minutes before kickoff", which let
-- an alert arrive with two minutes left — accurate but useless, since the price
-- is gone before the message is read. It becomes a band with both edges, so an
-- alert always leaves time to act.
--
-- pollMinutes now means the EFFECTIVE cadence rather than the workflow's cron
-- interval: the workflow fires every 5 minutes and polls 5 times within each
-- run, so the real figure is 1. It only feeds the spend projection and the
-- too-slow-for-the-band warning, both of which were wrong at 5.




-- AlterTable
ALTER TABLE "OddsWatchSettings" DROP COLUMN "alertWithinMinutes",
ADD COLUMN     "alertFromMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "alertToMinutes" INTEGER NOT NULL DEFAULT 10,
ALTER COLUMN "pollMinutes" SET DEFAULT 1;

