import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { commissionPercentForPlan } from "@/lib/plans";
import { isEmailVerified } from "@/lib/verification";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { id: handicapperId } });
  if (!handicapper) return NextResponse.json({ error: "Handicapper not found" }, { status: 404 });
  if (handicapper.userId === session.user.id) {
    return NextResponse.json({ error: "You can't subscribe to yourself" }, { status: 400 });
  }
  if (!handicapper.stripeAccountReady || !handicapper.stripePriceId || !handicapper.stripeAccountId) {
    return NextResponse.json({ error: "This handicapper hasn't enabled subscriptions yet" }, { status: 400 });
  }

  const existingActive = await prisma.subscription.findUnique({
    where: { subscriberId_handicapperId: { subscriberId: session.user.id, handicapperId } },
  });
  if (existingActive?.status === "ACTIVE") {
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
    line_items: [{ price: handicapper.stripePriceId, quantity: 1 }],
    subscription_data: {
      application_fee_percent: commissionPercentForPlan(handicapper.plan),
      transfer_data: { destination: handicapper.stripeAccountId },
      metadata: { subscriberId: session.user.id, handicapperId: handicapper.id },
    },
    metadata: { subscriberId: session.user.id, handicapperId: handicapper.id },
    success_url: `${appUrl}/handicappers/${handicapper.handle}?subscribed=1`,
    cancel_url: `${appUrl}/handicappers/${handicapper.handle}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
