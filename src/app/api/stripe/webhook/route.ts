import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus } from "@prisma/client";

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
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object);
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
