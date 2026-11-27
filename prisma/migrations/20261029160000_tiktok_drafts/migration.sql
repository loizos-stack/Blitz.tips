-- Pushing recap videos into the connected TikTok account's drafts.
--
-- Two parts: the single-row account table that holds the OAuth grant, and four
-- columns on RecapVideo recording the last push of that video. See the model
-- comments in schema.prisma.
--
-- Additive only. Every new column is nullable with no default, so this is safe
-- to run before the code that uses it ships — which is the order to do it in,
-- because the admin page queries TikTokAccount and would fail without it.

-- CreateTable
CREATE TABLE "TikTokAccount" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openId" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TikTokAccount_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "RecapVideo" ADD COLUMN     "tiktokPublishId" TEXT,
ADD COLUMN     "tiktokStatus" TEXT,
ADD COLUMN     "tiktokError" TEXT,
ADD COLUMN     "tiktokSentAt" TIMESTAMP(3);
