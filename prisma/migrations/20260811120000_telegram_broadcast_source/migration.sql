-- Distinguishes an automatic broadcast (a handicapper posting a free tip) from
-- one an admin sent by hand. Nullable, so existing rows stay correct as manual.
ALTER TABLE "TelegramBroadcast" ADD COLUMN "source" TEXT;
