import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, getOrCreatePlanPrice } from "@/lib/stripe";
import { siteUrl } from "@/lib/site";
import type { BillingInterval, HandicapperPlan } from "@prisma/client";

const appUrl = siteUrl();

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const plan = body?.plan as HandicapperPlan | undefined;
  const interval = body?.interval as BillingInterval | undefined;

  if (plan !== "SILVER" && plan !== "GOLD") {
    return NextResponse.json({ error: "Plan must be SILVER or GOLD to check out" }, { status: 400 });
  }
  if (interval !== "MONTHLY" && interval !== "ANNUAL") {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) return NextResponse.json({ error: "No handicapper profile" }, { status: 404 });

  let customerId = handicapper.planStripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { handicapperProfileId: handicapper.id, kind: "handicapper_plan" },
    });
    customerId = customer.id;
    await prisma.handicapperProfile.update({
      where: { id: handicapper.id },
      data: { planStripeCustomerId: customerId },
    });
  }

  const priceId = await getOrCreatePlanPrice(plan, interval);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: { kind: "handicapper_plan", handicapperProfileId: handicapper.id, plan, interval },
    },
    metadata: { kind: "handicapper_plan", handicapperProfileId: handicapper.id, plan, interval },
    success_url: `${appUrl}/dashboard/handicapper?plan=updated`,
    cancel_url: `${appUrl}/dashboard/handicapper`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
