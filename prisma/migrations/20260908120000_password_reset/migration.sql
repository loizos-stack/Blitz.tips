-- Password-reset links. See the model comment in schema.prisma for why the
-- token is stored hashed rather than raw.
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

CREATE INDEX "PasswordResetToken_identifier_idx" ON "PasswordResetToken"("identifier");
