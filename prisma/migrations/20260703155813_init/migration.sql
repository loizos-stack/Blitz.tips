-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUBSCRIBER', 'HANDICAPPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PickResult" AS ENUM ('PENDING', 'WIN', 'LOSS', 'PUSH', 'VOID');

-- CreateEnum
CREATE TYPE "PickSport" AS ENUM ('NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'SOCCER', 'GOLF', 'TENNIS', 'UFC_MMA', 'OTHER');

-- CreateEnum
CREATE TYPE "BetType" AS ENUM ('SPREAD', 'MONEYLINE', 'TOTAL', 'PROP', 'PARLAY', 'FUTURES');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SUBSCRIBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "HandicapperProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "coverUrl" TEXT,
    "sports" "PickSport"[] DEFAULT ARRAY[]::"PickSport"[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "monthlyPriceCents" INTEGER NOT NULL DEFAULT 2999,
    "stripeAccountId" TEXT,
    "stripeAccountReady" BOOLEAN NOT NULL DEFAULT false,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandicapperProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "sport" "PickSport" NOT NULL,
    "league" TEXT,
    "matchup" TEXT NOT NULL,
    "betType" "BetType" NOT NULL,
    "selection" TEXT NOT NULL,
    "odds" INTEGER NOT NULL,
    "units" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "analysis" TEXT,
    "result" "PickResult" NOT NULL DEFAULT 'PENDING',
    "isPremium" BOOLEAN NOT NULL DEFAULT true,
    "eventStartsAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "handicapperId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "HandicapperProfile_userId_key" ON "HandicapperProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HandicapperProfile_handle_key" ON "HandicapperProfile"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "HandicapperProfile_stripeAccountId_key" ON "HandicapperProfile"("stripeAccountId");

-- CreateIndex
CREATE INDEX "HandicapperProfile_handle_idx" ON "HandicapperProfile"("handle");

-- CreateIndex
CREATE INDEX "Pick_handicapperId_createdAt_idx" ON "Pick"("handicapperId", "createdAt");

-- CreateIndex
CREATE INDEX "Pick_result_idx" ON "Pick"("result");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_handicapperId_status_idx" ON "Subscription"("handicapperId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriberId_handicapperId_key" ON "Subscription"("subscriberId", "handicapperId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandicapperProfile" ADD CONSTRAINT "HandicapperProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_handicapperId_fkey" FOREIGN KEY ("handicapperId") REFERENCES "HandicapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_handicapperId_fkey" FOREIGN KEY ("handicapperId") REFERENCES "HandicapperProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
