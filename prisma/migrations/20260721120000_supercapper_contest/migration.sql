-- Contest status enum
CREATE TYPE "ContestStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'SETTLED');

-- Contest
CREATE TABLE "Contest" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT,
  "prizePoolCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "prizeSplitCents" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "minPicks" INTEGER NOT NULL DEFAULT 20,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "ContestStatus" NOT NULL DEFAULT 'DRAFT',
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");
CREATE INDEX "Contest_status_idx" ON "Contest"("status");

-- ContestEntry
CREATE TABLE "ContestEntry" (
  "id" TEXT NOT NULL,
  "contestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "finalRank" INTEGER,
  "prizeCents" INTEGER,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContestEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContestEntry_contestId_userId_key" ON "ContestEntry"("contestId", "userId");
CREATE INDEX "ContestEntry_contestId_idx" ON "ContestEntry"("contestId");

-- ContestPick
CREATE TABLE "ContestPick" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "sport" "PickSport" NOT NULL,
  "league" TEXT,
  "matchup" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "odds" INTEGER NOT NULL,
  "units" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "result" "PickResult" NOT NULL DEFAULT 'PENDING',
  "eventStartsAt" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  "settledBy" TEXT,
  "oddsApiEventId" TEXT,
  "oddsApiSportKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContestPick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContestPick_entryId_idx" ON "ContestPick"("entryId");
CREATE INDEX "ContestPick_result_idx" ON "ContestPick"("result");

-- Foreign keys
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContestPick" ADD CONSTRAINT "ContestPick_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the Supercapper Contest: $50,000 guaranteed, top 20 split,
-- Aug 3 2026 → Jan 10 2027, ROI-ranked with a 20-pick floor. OPEN for entries.
INSERT INTO "Contest" (
  "id", "slug", "name", "tagline", "prizePoolCents", "currency",
  "prizeSplitCents", "minPicks", "startsAt", "endsAt", "status", "updatedAt"
) VALUES (
  'contest_supercapper_2026',
  'supercapper',
  'Supercapper Contest',
  'Free to enter. $50,000 guaranteed. Best ROI wins.',
  5000000,
  'USD',
  ARRAY[1550000,800000,500000,400000,300000,250000,200000,175000,150000,125000,100000,90000,80000,70000,60000,50000,40000,30000,20000,10000]::INTEGER[],
  20,
  '2026-08-03T00:00:00.000Z',
  '2027-01-10T23:59:59.000Z',
  'OPEN',
  CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;
