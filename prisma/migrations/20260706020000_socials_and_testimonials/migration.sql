-- AlterTable
ALTER TABLE "HandicapperProfile" ADD COLUMN     "xUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "youtubeUrl" TEXT,
ADD COLUMN     "tiktokUrl" TEXT,
ADD COLUMN     "discordUrl" TEXT,
ADD COLUMN     "telegramUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Testimonial_handicapperId_idx" ON "Testimonial"("handicapperId");

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_handicapperId_fkey" FOREIGN KEY ("handicapperId") REFERENCES "HandicapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
