-- Per-recipient record of broadcasts that actually arrived, so a resend can
-- skip the people who already got the message and still retry the ones who
-- didn't. Only successes are written — see the model comment.

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The guard's only query: has THIS address had THIS subject recently.
CREATE INDEX "EmailDelivery_email_subjectKey_sentAt_idx" ON "EmailDelivery"("email", "subjectKey", "sentAt");

-- CreateIndex
CREATE INDEX "EmailDelivery_sentAt_idx" ON "EmailDelivery"("sentAt");
