import "server-only";
import { prisma } from "@/lib/prisma";
import { PASS_DAYS } from "@/lib/nowpayments";
import type { BillingIntervalPass } from "@prisma/client";

/**
 * Give a subscriber a one-time access pass.
 *
 * Both routes that sell a pass — crypto, and an off-platform transfer an
 * admin has confirmed — need exactly this, and the rules in it are easy to
 * get subtly wrong a second time:
 *
 *  - An unexpired pass is extended from its own end date, not from now, so
 *    buying early doesn't throw away the days already paid for.
 *  - A *Stripe* subscription is never extended this way. It bills on its own
 *    schedule, and moving its period end would quietly decouple access from
 *    billing.
 *  - `cancelAtPeriodEnd` is set because a pass is a purchase, not a standing
 *    order: it runs out unless somebody buys another.
 *
 * Returns when the access now runs until.
 */
export async function grantAccessPass({
  subscriberId,
  handicapperId,
  interval,
}: {
  subscriberId: string;
  handicapperId: string;
  interval: BillingIntervalPass;
}): Promise<Date> {
  const existing = await prisma.subscription.findUnique({
    where: { subscriberId_handicapperId: { subscriberId, handicapperId } },
  });

  const base =
    existing?.status === "ACTIVE" &&
    !existing.stripeSubscriptionId &&
    existing.currentPeriodEnd &&
    existing.currentPeriodEnd > new Date()
      ? existing.currentPeriodEnd
      : new Date();
  const currentPeriodEnd = new Date(base.getTime() + PASS_DAYS[interval] * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { subscriberId_handicapperId: { subscriberId, handicapperId } },
    create: {
      subscriberId,
      handicapperId,
      status: "ACTIVE",
      currentPeriodEnd,
      cancelAtPeriodEnd: true,
    },
    update: {
      status: "ACTIVE",
      stripeSubscriptionId: null,
      currentPeriodEnd,
      cancelAtPeriodEnd: true,
    },
  });

  return currentPeriodEnd;
}
