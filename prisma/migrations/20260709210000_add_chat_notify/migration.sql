-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifyTelegram" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifyDiscord" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramLinkToken" TEXT;
ALTER TABLE "User" ADD COLUMN "discordUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramLinkToken_key" ON "User"("telegramLinkToken");
