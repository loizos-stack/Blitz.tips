import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
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
}

/** A handicapper's own plan subscription with the platform — separate revenue stream from syncSubscription above. */
async function syncHandicapperPlanSubscription(subscription: Stripe.Subscription) {
  const handicapperProfileId = subscription.metadata?.handicapperProfileId;
  const plan = subscription.metadata?.plan as HandicapperPlan | undefined;
  const interval = subscription.metadata?.interval as BillingInterval | undefined;
  if (!handicapperProfileId || !plan || !interval) return;

  const status = mapStatus(subscription.status);
  const periodEndUnix = subscription.items.data[0]?.current_period_end;

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
