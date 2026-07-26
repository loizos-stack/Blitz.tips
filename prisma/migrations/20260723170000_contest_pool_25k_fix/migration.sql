-- Guarantee the Supercapper pool is exactly $25,000 (2,500,000 cents), not more.
-- Idempotent safety net so the headline always reads $25k regardless of any
-- prior admin edit that may have changed the stored amount.
UPDATE "Contest"
SET "prizePoolCents" = 2500000,
    "prizeSplitCents" = ARRAY[775000,400000,250000,200000,150000,125000,100000,87500,75000,62500,50000,45000,40000,35000,30000,25000,20000,15000,10000,5000]::INTEGER[]
WHERE "slug" = 'supercapper';
