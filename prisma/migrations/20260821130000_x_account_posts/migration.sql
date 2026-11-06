-- The X (Twitter) posting tool: one connected account plus a post history.
--
-- XAccount is single-row by construction — `id` defaults to 'default' and is
-- the primary key — so connecting a different account replaces the grant rather
-- than accumulating several with no way to tell which one a post went to.
--
-- Tokens are stored encrypted by the application, not in the clear. They are
-- live credentials rather than identifiers: unlike the Discord user id stored
-- next door, a leaked refresh token is an account takeover.
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "xUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XAccount_pkey" PRIMARY KEY ("id")
);

-- Attempted posts, successful or not. Failures are kept: a post that didn't
-- land is the row you most need to see.
CREATE TABLE "XPost" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "asset" TEXT,
    "tweetId" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "source" TEXT,
    "sentById" TEXT NOT NULL,
    "sentByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "XPost_createdAt_idx" ON "XPost"("createdAt");
