-- Referrals. A user's own code to hand out, plus who brought them in.
-- referredById is set once at signup and never updated: attribution that can be
-- edited later isn't attribution.
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;
ALTER TABLE "User" ADD COLUMN "referredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- SetNull rather than Cascade: deleting a referrer must not delete the people
-- they brought in.
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey"
    FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
