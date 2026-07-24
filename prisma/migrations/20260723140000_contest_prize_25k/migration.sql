-- Reduce the Supercapper Contest guaranteed pool from $50,000 to $25,000.
-- The prize ladder is halved (still top-20, sums to exactly $25,000); ICM
-- smooths the actual payouts from this ladder at settlement.
UPDATE "Contest"
SET
  "prizePoolCents" = 2500000,
  "prizeSplitCents" = ARRAY[775000,400000,250000,200000,150000,125000,100000,87500,75000,62500,50000,45000,40000,35000,30000,25000,20000,15000,10000,5000]::INTEGER[],
  "tagline" = 'Free to enter. $25,000 guaranteed. Best ROI wins.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'supercapper';
