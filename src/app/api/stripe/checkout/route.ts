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
import { collectsOnPlatform, platformCollectEnabled } from "@/lib/platform-collect";

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
  // Two ways a card subscription can work, and the handicapper's Connect
  // status picks between them:
  //
  //   connected    -> destination charge. Stripe splits the money as it takes
  //                   it and pays the handicapper directly. Always preferred.
  //   not connected-> the platform collects the whole charge and owes the
  //                   handicapper their share, settled by hand. See
  //                   lib/platform-collect.
  //
  // Before this, the second case was simply refused, which is why a site with
  // one connected handicapper had one handicapper anybody could subscribe to.
  const onPlatform = collectsOnPlatform(handicapper, await platformCollectEnabled());
  if (!onPlatform && (!handicapper.stripeAccountReady || !handicapper.stripeAccountId)) {
    return NextResponse.json({ error: "This handicapper hasn't enabled subscriptions yet" }, { status: 400 });
  }
  // Captured before the ensureSubscriberPrices reassignment below, which
  // widens `handicapper` back to a nullable-fields type.
  const stripeAccountId = handicapper.stripeAccountId;
  const handicapperPlan = handicapper.plan;
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

  // A free trial the handicapper set applies to weekly/monthly only, never annual.
  const trialDays =
    interval !== "ANNUAL" && handicapper.subscriptionTrialDays
      ? handicapper.subscriptionTrialDays
      : undefined;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      // No application fee and no transfer when the platform is collecting:
      // both of those tell Stripe to move money to a connected account, and
      // there isn't one. The split is recorded in our own ledger instead, off
      // `collect` below.
      ...(onPlatform
        ? {}
        : {
            application_fee_percent: commissionPercentForPlan(handicapperPlan),
            transfer_data: { destination: stripeAccountId! },
          }),
      // `collect` and `interval` travel on the SUBSCRIPTION, not just the
      // checkout session, because the thing that records each month's money is
      // an invoice webhook — and an invoice knows its subscription, not the
      // session that started it a year ago.
      metadata: {
        subscriberId: session.user.id,
        handicapperId: handicapper.id,
        collect: onPlatform ? "platform" : "connect",
        interval,
      },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    metadata: { subscriberId: session.user.id, handicapperId: handicapper.id },
    success_url: `${appUrl}/handicappers/${handicapper.handle}?subscribed=1`,
    cancel_url: `${appUrl}/handicappers/${handicapper.handle}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
