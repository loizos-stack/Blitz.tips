-- Cached translations of pick write-ups, so a given analysis is translated
-- into a given language once however many people read it.

-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "analysisLang" TEXT;

-- CreateTable
CREATE TABLE "PickTranslation" (
    "id" TEXT NOT NULL,
    "pickId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The unique key is also the lookup: every read is "this pick, this language".
CREATE UNIQUE INDEX "PickTranslation_pickId_language_key" ON "PickTranslation"("pickId", "language");

-- AddForeignKey
ALTER TABLE "PickTranslation" ADD CONSTRAINT "PickTranslation_pickId_fkey" FOREIGN KEY ("pickId") REFERENCES "Pick"("id") ON DELETE CASCADE ON UPDATE CASCADE;
