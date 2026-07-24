-- CreateTable
CREATE TABLE "ParlayLeg" (
    "id" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "sport" "PickSport",
    "league" TEXT,
    "matchup" TEXT NOT NULL,
    "selection" TEXT NOT NULL,
    "odds" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParlayLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParlayLeg_pickId_idx" ON "ParlayLeg"("pickId");

-- AddForeignKey
ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "Pick"("id") ON DELETE CASCADE ON UPDATE CASCADE;
