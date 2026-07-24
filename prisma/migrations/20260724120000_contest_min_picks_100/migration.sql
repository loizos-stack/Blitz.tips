-- Anyone can post contest picks, but prize eligibility now needs 100 graded
-- picks (was 20) so the prize pool rewards sustained, season-long volume.
UPDATE "Contest" SET "minPicks" = 100 WHERE "slug" = 'supercapper';
