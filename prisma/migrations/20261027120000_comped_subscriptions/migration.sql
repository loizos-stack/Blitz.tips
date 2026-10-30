-- Mark subscriptions an admin gave away, so the financials tab can stop
-- counting them as money.

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "compedAt" TIMESTAMP(3),
ADD COLUMN     "compedByEmail" TEXT,
ADD COLUMN     "compedById" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_compedAt_idx" ON "Subscription"("compedAt");

-- Backfill from the admin audit log, which already recorded every grant: the
-- target is "<customer email>→@<handle>" and the row carries who did it and
-- when. Without this, every subscription given away before today would keep
-- counting as revenue forever, since nothing else distinguishes it from a
-- crypto pass.
--
-- Only the most recent grant per pair is used, and only where no Stripe
-- subscription has since taken over — someone who was comped and later paid
-- is a paying customer, and their money belongs in the figures.
WITH grants AS (
  SELECT DISTINCT ON (lower(split_part("targetId", '→', 1)), lower(ltrim(split_part("targetId", '→', 2), '@')))
    lower(split_part("targetId", '→', 1))              AS email,
    lower(ltrim(split_part("targetId", '→', 2), '@'))  AS handle,
    "actorId"                                          AS actor_id,
    "actorEmail"                                       AS actor_email,
    "createdAt"                                        AS granted_at
  FROM "AdminAuditLog"
  WHERE "action" = 'subscription.grant'
    AND position('→' in "targetId") > 0
  ORDER BY
    lower(split_part("targetId", '→', 1)),
    lower(ltrim(split_part("targetId", '→', 2), '@')),
    "createdAt" DESC
)
UPDATE "Subscription" s
SET "compedAt"      = g.granted_at,
    "compedById"    = g.actor_id,
    "compedByEmail" = g.actor_email
FROM grants g
JOIN "User" u                ON lower(u."email")  = g.email
JOIN "HandicapperProfile" hp ON lower(hp."handle") = g.handle
WHERE s."subscriberId" = u."id"
  AND s."handicapperId" = hp."id"
  AND s."stripeSubscriptionId" IS NULL;
