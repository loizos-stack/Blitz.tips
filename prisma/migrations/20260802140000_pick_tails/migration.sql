-- Tail/fade: one row per user per pick, side stored rather than implied so a
-- switch is an update instead of a delete-and-insert.
CREATE TABLE "PickTail" (
    "id" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tailed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickTail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PickTail_pickId_userId_key" ON "PickTail"("pickId", "userId");
CREATE INDEX "PickTail_pickId_idx" ON "PickTail"("pickId");
CREATE INDEX "PickTail_userId_idx" ON "PickTail"("userId");

ALTER TABLE "PickTail" ADD CONSTRAINT "PickTail_pickId_fkey"
    FOREIGN KEY ("pickId") REFERENCES "Pick"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PickTail" ADD CONSTRAINT "PickTail_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
