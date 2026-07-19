import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { planPriceCents, PLAN_DEFINITIONS } from "@/lib/plans";
import { nowPaymentsConfigured, createInvoice } from "@/lib/nowpayments";
import { siteUrl } from "@/lib/site";
import type { BillingInterval, HandicapperPlan } from "@prisma/client";

const appUrl = siteUrl();

// Start a crypto checkout for a handicapper's own Silver/Gold plan: a one-time
// NOWPayments invoice that activates the plan for one interval (prepaid, no
// auto-renew). The crypto alternative to the recurring Stripe plan subscription.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!nowPaymentsConfigured()) {
    return NextResponse.json({ error: "Crypto payments aren't enabled" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const plan = body?.plan as HandicapperPlan | undefined;
  const interval = body?.interval as BillingInterval | undefined;

  if (plan !== "SILVER" && plan !== "GOLD") {
    return NextResponse.json({ error: "Plan must be SILVER or GOLD" }, { status: 400 });
  }
  if (interval !== "MONTHLY" && interval !== "ANNUAL") {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) return NextResponse.json({ error: "No handicapper profile" }, { status: 404 });

  const amountCents = planPriceCents(plan, interval);
  if (amountCents == null) {
    return NextResponse.json({ error: "That plan interval isn't available" }, { status: 400 });
  }

  // Distinct prefix so the shared IPN webhook routes this to the plan handler.
  const orderId = `blitzplan_${randomBytes(12).toString("hex")}`;
  const term = interval === "ANNUAL" ? "1 year" : "1 month";

  try {
    const invoice = await createInvoice({
      orderId,
      description: `${PLAN_DEFINITIONS[plan].label} plan (${term}) on Blitz.tips`,
      amountCents,
      priceCurrency: "USD",
      ipnUrl: `${appUrl}/api/crypto/webhook`,
      successUrl: `${appUrl}/dashboard/handicapper/plan?crypto=pending`,
      cancelUrl: `${appUrl}/dashboard/handicapper/plan`,
    });

    await prisma.planCryptoPayment.create({
      data: { chargeCode: orderId, handicapperId: handicapper.id, plan, interval, amountCents },
    });

    return NextResponse.json({ url: invoice.invoice_url });
  } catch (error) {
    console.error("Plan crypto checkout failed:", error);
    return NextResponse.json({ error: "Couldn't start crypto checkout. Try again shortly." }, { status: 500 });
  }
}
