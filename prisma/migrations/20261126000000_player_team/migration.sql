-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "playerTeamAbbr" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "teamAbbr" TEXT,
ADD COLUMN     "teamName" TEXT;

