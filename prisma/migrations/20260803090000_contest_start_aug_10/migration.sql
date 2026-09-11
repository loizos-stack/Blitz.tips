-- Push the Supercapper Contest start from Aug 3 to Aug 10 2026 (the following
-- Monday), giving the launch another week.
--
-- Only startsAt moves. endsAt (Jan 10 2027) and registrationClosesAt (Sep 27
-- 2026) are unchanged, so the contest is a week shorter rather than shifted —
-- if the whole window was meant to slide, that's a second change.
--
-- Midnight UTC, matching how the original date was set, so the countdown and
-- the first day's board agree with every other contest timestamp.
--
-- Note: picks posted while the contest was briefly live (Aug 3) are left alone.
-- They stay attached to their entries; nothing else accepts new picks until the
-- new start. Deleting them would be destroying entrant data to tidy a date.
--
-- Idempotent, and it overwrites whatever the row holds so the published date
-- can't drift from the one the site enforces.
UPDATE "Contest"
SET "startsAt" = '2026-08-10T00:00:00.000Z'
WHERE "slug" = 'supercapper';
