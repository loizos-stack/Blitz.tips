-- Replace handicapper-authored testimonials with subscriber reviews (1–5 stars).
-- Testimonials were curated quotes; reviews are written by paid subscribers.
DROP TABLE IF EXISTS "Testimonial";

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Review_handicapperId_authorId_key" ON "Review"("handicapperId", "authorId");

CREATE INDEX "Review_handicapperId_idx" ON "Review"("handicapperId");

ALTER TABLE "Review" ADD CONSTRAINT "Review_handicapperId_fkey" FOREIGN KEY ("handicapperId") REFERENCES "HandicapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
