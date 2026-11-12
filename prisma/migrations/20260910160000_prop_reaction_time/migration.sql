-- When each book was first seen to move off its opening price, so the alert can
-- say which book led and how long the others took to follow.
ALTER TABLE "PropOpeningLine" ADD COLUMN     "firstMovedAt" TIMESTAMP(3),
ADD COLUMN     "firstMovedPrice" INTEGER;
