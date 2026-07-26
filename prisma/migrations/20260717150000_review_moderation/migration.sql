-- Hold reviews for admin moderation before they appear publicly.
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Review" ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Review" ADD COLUMN "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN "moderatedBy" TEXT;

DROP INDEX "Review_handicapperId_idx";
CREATE INDEX "Review_handicapperId_status_idx" ON "Review"("handicapperId", "status");
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");
