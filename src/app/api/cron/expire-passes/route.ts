import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Daily sweep for crypto access passes (Subscriptions without a Stripe
 * subscription): expires passes whose period has ended and drops a renewal
 * reminder for passes ending within 3 days. Stripe-billed subscriptions are
 * untouched — Stripe's webhooks own their lifecycle.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // 1) Expire ended passes.
  const ended = await prisma.subscription.findMany({
    where: { status: "ACTIVE", stripeSubscriptionId: null, currentPeriodEnd: { lt: now } },
    include: { handicapper: { select: { handle: true, displayName: true } } },
  });
  for (const sub of ended) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELED" } });
    await prisma.notification
      .create({
        data: {
          userId: sub.subscriberId,
          type: "crypto.expired",
          title: "Your pass has expired",
          body: `Your access to ${sub.handicapper.displayName} has ended — renew to keep getting their premium picks.`,
          url: `/handicappers/${sub.handicapper.handle}`,
          handicapperId: sub.handicapperId,
        },
      })
      .catch(() => null);
  }

  // 2) Remind passes expiring soon (once per pass period, deduped by a recent
  //    reminder notification for the same pair).
  const expiring = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      stripeSubscriptionId: null,
      currentPeriodEnd: { gte: now, lte: soon },
    },
    include: { handicapper: { select: { handle: true, displayName: true } } },
  });
  let reminded = 0;
  for (const sub of expiring) {
    const already = await prisma.notification.findFirst({
      where: {
        userId: sub.subscriberId,
        handicapperId: sub.handicapperId,
        type: "crypto.expiring",
        createdAt: { gte: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
      },
    });
    if (already) continue;
    await prisma.notification
      .create({
        data: {
          userId: sub.subscriberId,
          type: "crypto.expiring",
          title: "Your pass expires soon",
          body: `Your access to ${sub.handicapper.displayName} ends ${sub.currentPeriodEnd?.toLocaleDateString()}. Renew to keep their picks coming.`,
          url: `/handicappers/${sub.handicapper.handle}`,
          handicapperId: sub.handicapperId,
        },
      })
      .catch(() => null);
    reminded++;
  }

  return NextResponse.json({ expired: ended.length, reminded });
}
