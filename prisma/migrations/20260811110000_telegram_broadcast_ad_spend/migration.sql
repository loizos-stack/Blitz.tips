-- Telegram channel broadcasts (owned-channel promotion via the bot) and a
-- manual ad-spend ledger for networks with no API to read spend from.
--
-- Telegram's paid ad platform has no public API, so its numbers can only be
-- typed in. Meta's are not recorded here on purpose — those come live from the
-- Marketing API, and a second hand-entered copy would only drift.

CREATE TABLE "TelegramBroadcast" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "chatTitle" TEXT,
    "text" TEXT NOT NULL,
    "asset" TEXT,
    "messageId" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "sentById" TEXT NOT NULL,
    "sentByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramBroadcast_createdAt_idx" ON "TelegramBroadcast"("createdAt");

CREATE TABLE "AdSpendEntry" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL,
    "spendCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "impressions" INTEGER,
    "clicks" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdSpendEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdSpendEntry_platform_spentOn_idx" ON "AdSpendEntry"("platform", "spentOn");
