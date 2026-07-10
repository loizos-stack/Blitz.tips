import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { commissionPercentForPlan } from "@/lib/plans";
import { isEmailVerified } from "@/lib/verification";
import { packageCents, type PackageInterval } from "@/lib/subscriber-pricing";
import { nowPaymentsConfigured, createInvoice, type PassInterval } from "@/lib/nowpayments";
import { siteUrl } from "@/lib/site";

const appUrl = siteUrl();

// Start a crypto checkout: a one-time NOWPayments invoice that buys a
// fixed-length access pass at the handicapper's package price. Unlike Stripe,
// crypto needs no connected account, so it also works for handicappers who
// haven't finished (or started) Stripe onboarding.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!nowPaymentsConfigured()) {
    return NextResponse.json({ error: "Crypto payments aren't enabled" }, { status: 400 });
  }

  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json({ error: "Please verify your email before subscribing." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const handicapperId = body?.handicapperId;
  if (typeof handicapperId !== "string") {
    return NextResponse.json({ error: "Missing handicapperId" }, { status: 400 });
  }
  const interval: PassInterval = ["WEEKLY", "MONTHLY", "ANNUAL"].includes(body?.interval)
    ? body.interval
    : "MONTHLY";

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { id: handicapperId } });
  if (!handicapper) return NextResponse.json({ error: "Handicapper not found" }, { status: 404 });
  if (handicapper.userId === session.user.id) {
    return NextResponse.json({ error: "You can't subscribe to yourself" }, { status: 400 });
  }
  if (handicapper.suspendedAt) {
    return NextResponse.json({ error: "This handicapper isn't accepting subscribers" }, { status: 400 });
  }

  const amountCents = packageCents(handicapper, interval as PackageInterval);
  if (amountCents == null) {
    return NextResponse.json({ error: "That package isn't offered by this handicapper" }, { status: 400 });
  }

  const existing = await prisma.subscription.findUnique({
    where: { subscriberId_handicapperId: { subscriberId: session.user.id, handicapperId } },
  });
  // A recurring Stripe subscription is already billing — don't double-charge.
  // An active crypto pass is fine: paying again extends it from its end date.
  if (existing?.status === "ACTIVE" && existing.stripeSubscriptionId) {
    return NextResponse.json({ error: "You're already subscribed" }, { status: 409 });
  }

  const commissionCents = Math.round((amountCents * commissionPercentForPlan(handicapper.plan)) / 100);

  // Our own order id ties the IPN callback back to this purchase.
  const orderId = `blitz_${randomBytes(12).toString("hex")}`;

  try {
    const invoice = await createInvoice({
      orderId,
      description: `${PASS_LABEL[interval]} of premium picks from ${handicapper.displayName} on Blitz.tips`,
      amountCents,
      ipnUrl: `${appUrl}/api/crypto/webhook`,
      successUrl: `${appUrl}/handicappers/${handicapper.handle}?crypto=pending`,
      cancelUrl: `${appUrl}/handicappers/${handicapper.handle}`,
    });

    await prisma.cryptoPayment.create({
      data: {
        chargeCode: orderId,
        subscriberId: session.user.id,
        handicapperId: handicapper.id,
        interval,
        amountCents,
        commissionCents,
        netCents: amountCents - commissionCents,
      },
    });

    return NextResponse.json({ url: invoice.invoice_url });
  } catch (error) {
    console.error("Crypto checkout failed:", error);
    return NextResponse.json({ error: "Couldn't start crypto checkout. Try again shortly." }, { status: 500 });
  }
}

const PASS_LABEL: Record<PassInterval, string> = {
  WEEKLY: "1 week",
  MONTHLY: "30 days",
  ANNUAL: "1 year",
};
