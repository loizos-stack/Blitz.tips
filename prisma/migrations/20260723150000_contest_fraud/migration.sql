-- Contest anti-fraud: disqualification fields + IP/device signal log.
ALTER TABLE "ContestEntry" ADD COLUMN "disqualifiedAt" TIMESTAMP(3);
ALTER TABLE "ContestEntry" ADD COLUMN "disqualifiedReason" TEXT;

CREATE TABLE "ContestIpLog" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ip" TEXT NOT NULL,
  "userAgent" TEXT,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContestIpLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContestIpLog_contestId_ip_idx" ON "ContestIpLog"("contestId", "ip");
CREATE INDEX "ContestIpLog_entryId_idx" ON "ContestIpLog"("entryId");

ALTER TABLE "ContestIpLog" ADD CONSTRAINT "ContestIpLog_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContestIpLog" ADD CONSTRAINT "ContestIpLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
