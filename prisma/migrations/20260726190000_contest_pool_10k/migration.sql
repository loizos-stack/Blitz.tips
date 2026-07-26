-- Reduce the Supercapper Contest guaranteed pool from $25,000 to $10,000.
--
-- The ladder is the previous one scaled by 0.4, which divides evenly at every
-- place, so it still sums to exactly the headline figure (1,000,000 cents) with
-- no rounding drift. Shape is unchanged: still top-20, still the same relative
-- curve that ICM then chops across whatever places are actually open.
--
-- Idempotent: safe to re-run, and it overwrites whatever the row currently
-- holds so the headline can't drift from what's awarded.
UPDATE "Contest"
SET "prizePoolCents" = 1000000,
    "prizeSplitCents" = ARRAY[310000,160000,100000,80000,60000,50000,40000,35000,30000,25000,20000,18000,16000,14000,12000,10000,8000,6000,4000,2000]::INTEGER[],
    "tagline" = 'Free to enter. $10,000 guaranteed. Best ROI wins.'
WHERE "slug" = 'supercapper';
