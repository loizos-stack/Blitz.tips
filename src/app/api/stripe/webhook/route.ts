import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { notifyAdmins } from "@/lib/admin-alerts";
import type { BillingInterval, HandicapperPlan, SubscriptionStatus } from "@prisma/client";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
    case "unpaid":
      return "CANCELED";
    case "incomplete":
    case "paused":
    default:
      return "INCOMPLETE";
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const subscriberId = subscription.metadata?.subscriberId;
  const handicapperId = subscription.metadata?.handicapperId;
  if (!subscriberId || !handicapperId) return;

  const periodEndUnix = subscription.items.data[0]?.current_period_end;

  // Read before the write so the alert can tell a NEW subscription from the
  // stream of updates Stripe sends for the same one. Without this every
  // renewal, card update and cancellation would announce itself as a sale.
  const before = await prisma.subscription.findUnique({
    where: { subscriberId_handicapperId: { subscriberId, handicapperId } },
    select: { status: true },
  });

  await prisma.subscription.upsert({
    where: { subscriberId_handicapperId: { subscriberId, handicapperId } },
    create: {
      subscriberId,
      handicapperId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      status: mapStatus(subscription.status),
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      status: mapStatus(subscription.status),
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  await logActivity({
    actorId: subscriberId,
    action: `subscription.${mapStatus(subscription.status).toLowerCase()}`,
    targetType: "Subscription",
    targetId: subscription.id,
    detail: `subscriber ${subscriberId} → handicapper ${handicapperId}`,
  });

  // A sale is the first time this pair becomes ACTIVE. Coming back from
  // past_due counts as one too — the money arrived either way — but a renewal
  // of an already-active subscription does not.
  if (mapStatus(subscription.status) === "ACTIVE" && before?.status !== "ACTIVE") {
    const [subscriber, handicapper] = await Promise.all([
      prisma.user.findUnique({ where: { id: subscriberId }, select: { email: true, name: true } }),
      prisma.handicapperProfile.findUnique({
        where: { id: handicapperId },
        select: { handle: true, monthlyPriceCents: true, priceCurrency: true },
      }),
    ]);
    await notifyAdmins({
      kind: "subscription.new",
      title: `New subscription to @${handicapper?.handle ?? handicapperId}`,
      details: [
        ["Customer", subscriber?.email ?? subscriberId],
        ["Handicapper", `@${handicapper?.handle ?? handicapperId}`],
        ...(handicapper
          ? ([
              [
                "Price",
                `${(handicapper.monthlyPriceCents / 100).toFixed(2)} ${handicapper.priceCurrency}/mo`,
              ],
            ] as [string, string][])
          : []),
        ["Paid with", "Stripe"],
        ...(before ? ([["Previously", before.status]] as [string, string][]) : []),
      ],
      path: "/admin/subscriptions",
    });
  }
}

/** A handicapper's own plan subscription with the platform — separate revenue stream from syncSubscription above. */
async function syncHandicapperPlanSubscription(subscription: Stripe.Subscription) {
  const handicapperProfileId = subscription.metadata?.handicapperProfileId;
  const plan = subscription.metadata?.plan as HandicapperPlan | undefined;
  const interval = subscription.metadata?.interval as BillingInterval | undefined;
  if (!handicapperProfileId || !plan || !interval) return;

  const status = mapStatus(subscription.status);
  const periodEndUnix = subscription.items.data[0]?.current_period_end;
  // Mark the one-time free trial consumed the moment a trialing subscription
  // exists (or the checkout flagged one), so it can't be claimed twice.
  const trialConsumed =
    subscription.status === "trialing" ||
    Boolean(subscription.trial_end) ||
    subscription.metadata?.trial === "1";

  await prisma.handicapperProfile
    .update({
      where: { id: handicapperProfileId },
      data: {
        // A canceled/expired plan subscription reverts the handicapper to
        // Free rather than leaving them stuck on a paid tier's lower
        // commission rate with nothing actually being billed.
        plan: status === "CANCELED" ? "FREE" : plan,
        planInterval: status === "CANCELED" ? null : interval,
        planStatus: status,
        planStripeSubscriptionId: status === "CANCELED" ? null : subscription.id,
        planCurrentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
        planCancelAtPeriodEnd: subscription.cancel_at_period_end,
        ...(trialConsumed ? { planTrialUsed: true } : {}),
      },
    })
    .catch(() => undefined);
}

export async function POST(request: Request) {
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Missing signature");
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object;
      if (checkoutSession.mode === "subscription" && typeof checkoutSession.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
        if (subscription.metadata?.kind === "handicapper_plan") {
          await syncHandicapperPlanSubscription(subscription);
        } else {
          await syncSubscription(subscription);
        }
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      if (subscription.metadata?.kind === "handicapper_plan") {
        await syncHandicapperPlanSubscription(subscription);
      } else {
        await syncSubscription(subscription);
      }
      break;
    }
    case "account.updated": {
      const account = event.data.object;
      const ready = Boolean(account.charges_enabled && account.details_submitted);
      await prisma.handicapperProfile
        .updateMany({ where: { stripeAccountId: account.id }, data: { stripeAccountReady: ready } })
        .catch(() => undefined);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
