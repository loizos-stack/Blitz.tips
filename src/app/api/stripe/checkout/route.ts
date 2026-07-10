import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { commissionPercentForPlan } from "@/lib/plans";
import { isEmailVerified } from "@/lib/verification";
import {
  ensureSubscriberPrices,
  packageCents,
  packagePriceId,
  type PackageInterval,
} from "@/lib/subscriber-pricing";
import { siteUrl } from "@/lib/site";
import { isSubscriptionActive } from "@/lib/subscription-status";

const appUrl = siteUrl();

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json({ error: "Please verify your email before subscribing." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const handicapperId = body?.handicapperId;
  if (typeof handicapperId !== "string") {
    return NextResponse.json({ error: "Missing handicapperId" }, { status: 400 });
  }

  // Which package the subscriber picked; monthly (always offered) by default.
  const interval: PackageInterval = ["WEEKLY", "MONTHLY", "ANNUAL"].includes(body?.interval)
    ? body.interval
    : "MONTHLY";

  let handicapper = await prisma.handicapperProfile.findUnique({ where: { id: handicapperId } });
  if (!handicapper) return NextResponse.json({ error: "Handicapper not found" }, { status: 404 });
  if (handicapper.userId === session.user.id) {
    return NextResponse.json({ error: "You can't subscribe to yourself" }, { status: 400 });
  }
  if (handicapper.suspendedAt) {
    return NextResponse.json({ error: "This handicapper isn't accepting subscribers" }, { status: 400 });
  }
  if (!handicapper.stripeAccountReady || !handicapper.stripeAccountId) {
    return NextResponse.json({ error: "This handicapper hasn't enabled subscriptions yet" }, { status: 400 });
  }
  // Captured before the ensureSubscriberPrices reassignment below, which
  // widens `handicapper` back to a nullable-fields type.
  const stripeAccountId = handicapper.stripeAccountId;
  if (packageCents(handicapper, interval) == null) {
    return NextResponse.json({ error: "That package isn't offered by this handicapper" }, { status: 400 });
  }

  // The Stripe Price may not exist yet (created lazily after price changes) —
  // ensure it now, since checkout requires Stripe anyway.
  if (!packagePriceId(handicapper, interval)) {
    handicapper = await ensureSubscriberPrices(handicapper);
  }
  const priceId = packagePriceId(handicapper, interval);
  if (!priceId) {
    return NextResponse.json({ error: "This handicapper hasn't enabled subscriptions yet" }, { status: 400 });
  }

  const existingActive = await prisma.subscription.findUnique({
    where: { subscriberId_handicapperId: { subscriberId: session.user.id, handicapperId } },
  });
  if (isSubscriptionActive(existingActive)) {
    return NextResponse.json({ error: "You're already subscribed" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  let customerId = user?.stripeCustomerId ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: session.user.id }, data: { stripeCustomerId: customerId } });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      application_fee_percent: commissionPercentForPlan(handicapper.plan),
      transfer_data: { destination: stripeAccountId },
      metadata: { subscriberId: session.user.id, handicapperId: handicapper.id },
    },
    metadata: { subscriberId: session.user.id, handicapperId: handicapper.id },
    success_url: `${appUrl}/handicappers/${handicapper.handle}?subscribed=1`,
    cancel_url: `${appUrl}/handicappers/${handicapper.handle}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
