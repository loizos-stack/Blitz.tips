-- The X posting rotation's queue: one row per composed post, pending until it
-- is sent or dropped.

-- CreateEnum
CREATE TYPE "XQueueStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DISCARDED');

-- CreateTable
CREATE TABLE "XQueuedPost" (
    "id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "subject" TEXT,
    "status" "XQueueStatus" NOT NULL DEFAULT 'PENDING',
    "xPostId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "XQueuedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The queue view reads PENDING newest-first; the slot index serves the
-- "did this slot already run today" guard on every firing.
CREATE INDEX "XQueuedPost_status_createdAt_idx" ON "XQueuedPost"("status", "createdAt");

-- CreateIndex
CREATE INDEX "XQueuedPost_slot_createdAt_idx" ON "XQueuedPost"("slot", "createdAt");
