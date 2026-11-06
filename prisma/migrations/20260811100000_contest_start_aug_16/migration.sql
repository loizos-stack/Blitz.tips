-- Push the Supercapper Contest start from Aug 10 to Aug 16 2026 (the coming
-- Sunday), giving the launch another six days.
--
-- Unlike the previous move, this one happens while the contest is already
-- LIVE: it started Aug 10 and this runs on Aug 11. Setting startsAt into the
-- future un-launches it — the countdown reappears and the board stops taking
-- picks until the new date.
--
-- Picks posted during the Aug 10-11 window are left exactly where they are.
-- They now sit before startsAt, which means the standings query may exclude
-- them depending on how it windows picks. That is a reporting question for
-- whoever posted them, not a reason to delete entrant data to tidy a date.
-- Check the board after deploying: if early picks vanish from the standings,
-- either the window or those picks need a deliberate decision.
--
-- Only startsAt moves. endsAt (Jan 10 2027) and registrationClosesAt (Sep 27
-- 2026) are unchanged, so the contest is shorter again rather than shifted —
-- it is now five months minus thirteen days.
--
-- Midnight UTC, matching every other contest timestamp.
--
-- Idempotent, and it overwrites whatever the row holds so the published date
-- can't drift from the one the site enforces.
UPDATE "Contest"
SET "startsAt" = '2026-08-16T00:00:00.000Z'
WHERE "slug" = 'supercapper';
