import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { notifyAdmins } from "@/lib/admin-alerts";
import type { BillingInterval, BillingIntervalPass, HandicapperPlan, SubscriptionStatus } from "@prisma/client";
import { priceCurrencyOf, splitCents, subscriptionIdFromInvoice } from "@/lib/platform-collect";

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


/**
 * Record one month (or week, or year) of a platform-collected subscription.
 *
 * Only for subscriptions the platform collects itself — a Connect destination
 * charge needs no ledger entry, because Stripe has already moved the
 * handicapper's share and there is nothing left to settle. The marker is
 * `collect: "platform"` in the subscription's metadata, written at checkout.
 *
 * Driven by the invoice rather than the subscription because the subscription
 * fires `updated` for all sorts of reasons that are not money arriving — a
 * card change, a cancellation scheduled, a trial ending. An invoice that is
 * paid is money, once, and `stripeInvoiceId` is unique on the row, so a
 * webhook redelivery (Stripe guarantees at least once, not exactly once)
 * cannot record the same month twice.
 *
 * `amount_paid` rather than the subscription's price: it is what Stripe
 * actually collected, which is what a proration, a coupon, or a partially
 * credited period leaves behind. Owing the handicapper a share of a number
 * nobody paid would be a slow, quiet accounting error.
 */
async function recordPlatformEarning(invoice: Stripe.Invoice) {
  if (invoice.amount_paid <= 0) return;

  const subId = subscriptionIdFromInvoice(invoice);
  if (!subId) return;

  const subscription = await stripe.subscriptions.retrieve(subId);
  const meta = subscription.metadata ?? {};
  if (meta.collect !== "platform") return;

  const subscriberId = meta.subscriberId;
  const handicapperId = meta.handicapperId;
  if (!subscriberId || !handicapperId) return;

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { id: handicapperId },
    select: { plan: true, handle: true },
  });
  if (!handicapper) return;

  const { commissionCents, netCents } = splitCents(invoice.amount_paid, handicapper.plan);
  const interval: BillingIntervalPass =
    meta.interval === "WEEKLY" || meta.interval === "ANNUAL"
      ? (meta.interval as BillingIntervalPass)
      : "MONTHLY";

  // createMany + skipDuplicates rather than create: a redelivered webhook
  // should be a no-op, not a unique-constraint error that makes Stripe retry
  // it forever.
  const { count } = await prisma.platformEarning.createMany({
    data: [
      {
        stripeInvoiceId: invoice.id!,
        stripeSubscriptionId: subId,
        subscriberId,
        handicapperId,
        interval,
        amountCents: invoice.amount_paid,
        currency: priceCurrencyOf(invoice.currency),
        commissionCents,
        netCents,
        paidAt: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000),
      },
    ],
    skipDuplicates: true,
  });
  if (count === 0) return;

  await logActivity({
    actorId: subscriberId,
    action: "subscription.platform_collected",
    targetType: "PlatformEarning",
    targetId: invoice.id ?? subId,
    detail:
      `@${handicapper.handle}: collected ${(invoice.amount_paid / 100).toFixed(2)} ` +
      `${invoice.currency.toUpperCase()}, ${(netCents / 100).toFixed(2)} owed to the handicapper`,
  });
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
    // Money actually arriving on a platform-collected subscription. Both the
    // first payment and every renewal, which is why it is here and not folded
    // into checkout.session.completed — that one fires once, a subscription
    // bills forever.
    case "invoice.payment_succeeded":
    case "invoice.paid": {
      await recordPlatformEarning(event.data.object);
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
