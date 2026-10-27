-- First-party, cookieless page views. See the model comment in schema.prisma
-- for why no IP or cookie is stored and why the visitor digest rotates daily.

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "country" TEXT,
    "device" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Every admin query filters by time first and aggregates after, so this one
-- index carries all of them without taxing the write path.
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");
