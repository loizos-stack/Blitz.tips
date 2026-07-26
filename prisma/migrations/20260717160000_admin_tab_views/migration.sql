-- Per-admin "last viewed" markers for admin-nav number bubbles that mean
-- "new since you last looked" (users, handicappers, subscriptions).
CREATE TABLE "AdminTabView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tab" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTabView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminTabView_userId_tab_key" ON "AdminTabView"("userId", "tab");

ALTER TABLE "AdminTabView" ADD CONSTRAINT "AdminTabView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
