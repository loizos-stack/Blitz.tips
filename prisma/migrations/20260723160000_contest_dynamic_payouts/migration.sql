-- Scale paid places with entrant count and lock the field at registration close.
ALTER TABLE "Contest" ADD COLUMN "registrationClosesAt" TIMESTAMP(3);
ALTER TABLE "Contest" ADD COLUMN "dynamicPayouts" BOOLEAN NOT NULL DEFAULT false;

-- Supercapper: dynamic payouts on, registration closes Sep 27 2026 (UTC end of day).
UPDATE "Contest"
SET "dynamicPayouts" = true,
    "registrationClosesAt" = '2026-09-27T23:59:59.000Z'
WHERE "slug" = 'supercapper';
