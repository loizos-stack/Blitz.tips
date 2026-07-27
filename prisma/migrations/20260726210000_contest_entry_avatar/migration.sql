-- Contest entrants can upload an avatar shown wherever their name appears on
-- the contest pages. Nullable: entries without one fall back to the user's
-- account image, then to initials.
--
-- Handicappers don't use this column — their contest identity reuses their
-- handicapper profile avatar, so there's one picture to keep updated rather
-- than two that can disagree.
ALTER TABLE "ContestEntry" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
