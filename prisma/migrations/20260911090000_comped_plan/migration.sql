-- A comped (gifted) Silver/Gold plan: granted from the admin panel for a fixed
-- period, with no Stripe subscription behind it. Kept separate from the plan*
-- columns that belong to Stripe so the daily sweep that ends comps can never
-- touch a real subscription.
ALTER TABLE "HandicapperProfile" ADD COLUMN     "planCompedUntil" TIMESTAMP(3),
ADD COLUMN     "planCompedAt" TIMESTAMP(3),
ADD COLUMN     "planCompedById" TEXT,
ADD COLUMN     "planCompWarnedAt" TIMESTAMP(3);

-- The sweep asks only which comps are ending; without this it scans every
-- handicapper on the site to find the handful that matter.
CREATE INDEX "HandicapperProfile_planCompedUntil_idx" ON "HandicapperProfile"("planCompedUntil");
