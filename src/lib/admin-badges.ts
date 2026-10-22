import "server-only";
import { prisma } from "@/lib/prisma";
import type { AdminPermission } from "@/lib/permissions";

// Tabs whose badge means "new since you last looked". Each maps to a row-count
// created after the admin's AdminTabView.seenAt marker for that tab.
const TRACKED_TABS = ["users", "handicappers", "subscriptions"] as const;
type TrackedTab = (typeof TRACKED_TABS)[number];

/**
 * Counts for the admin-nav number bubbles.
 *
 * Two kinds of badge:
 *  - Queue tabs (tickets, chat, reviews) badge off live state — things that need
 *    action right now: open tickets, chats waiting for a human, reviews pending
 *    moderation. These don't clear just because you looked.
 *  - Activity tabs (users, handicappers, subscriptions) badge off "new since you
 *    last opened the tab" — new signups, new handicappers, new paid subs. Opening
 *    the tab marks it seen (markAdminTabSeen) and clears the bubble.
 *
 * The first time an admin is seen, activity tabs are baselined to "now" so we
 * don't flash the entire historical count at them.
 */
export async function getAdminBadgeCounts(userId: string): Promise<Partial<Record<AdminPermission, number>>> {
  // Ensure a baseline marker exists for each activity tab (created at now on the
  // very first call), so counts start at 0 rather than the full history.
  await prisma.adminTabView.createMany({
    data: TRACKED_TABS.map((tab) => ({ userId, tab })),
    skipDuplicates: true,
  });
  const markers = await prisma.adminTabView.findMany({
    where: { userId, tab: { in: [...TRACKED_TABS] } },
    select: { tab: true, seenAt: true },
  });
  const seenAt = new Map<string, Date>(markers.map((m) => [m.tab, m.seenAt]));
  const since = (tab: TrackedTab) => seenAt.get(tab) ?? new Date();

  const [tickets, chat, reviews, users, handicappers, subscriptions] = await Promise.all([
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.chat.count({ where: { status: "WAITING" } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { createdAt: { gt: since("users") } } }),
    prisma.handicapperProfile.count({ where: { createdAt: { gt: since("handicappers") } } }),
    prisma.subscription.count({ where: { status: "ACTIVE", createdAt: { gt: since("subscriptions") } } }),
  ]);

  return { tickets, chat, reviews, users, handicappers, subscriptions };
}

/**
 * Mark an activity tab as seen for this admin (clears its "new since" bubble).
 * No-op for tabs that aren't activity-tracked.
 */
export async function markAdminTabSeen(userId: string, tab: TrackedTab): Promise<void> {
  await prisma.adminTabView.upsert({
    where: { userId_tab: { userId, tab } },
    create: { userId, tab, seenAt: new Date() },
    update: { seenAt: new Date() },
  });
}
