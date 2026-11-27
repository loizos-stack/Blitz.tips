-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "playerEspnId" TEXT;

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sport" "PickSport" NOT NULL,
    "espnId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_sport_normalizedName_idx" ON "Player"("sport", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sport_espnId_key" ON "Player"("sport", "espnId");

