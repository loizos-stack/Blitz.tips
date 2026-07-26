import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// A one-time login link to the handicapper's own Stripe Express dashboard,
// where they can see balance, payouts, and update bank details.
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    select: { stripeAccountId: true },
  });
  if (!handicapper?.stripeAccountId) {
    return NextResponse.json({ error: "No connected Stripe account" }, { status: 404 });
  }

  try {
    const link = await stripe.accounts.createLoginLink(handicapper.stripeAccountId);
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Stripe login link failed:", error);
    const message = error instanceof Error ? error.message : "Couldn't open the payouts dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
