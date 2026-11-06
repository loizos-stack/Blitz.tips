-- Rendered results-recap videos, one row per covered day. See the model
-- comment in schema.prisma for why the figures are copied in rather than
-- recomputed on read.

-- CreateTable
CREATE TABLE "RecapVideo" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "settled" INTEGER NOT NULL,
    "record" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecapVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One day, one video: the nightly job relies on this to be safe to re-run.
CREATE UNIQUE INDEX "RecapVideo_date_key" ON "RecapVideo"("date");

-- CreateIndex
CREATE INDEX "RecapVideo_createdAt_idx" ON "RecapVideo"("createdAt");
