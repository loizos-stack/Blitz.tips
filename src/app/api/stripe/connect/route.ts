import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureSubscriberPrices } from "@/lib/subscriber-pricing";
import { siteUrl } from "@/lib/site";

const appUrl = siteUrl();

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) return NextResponse.json({ error: "No handicapper profile" }, { status: 404 });

  let accountId = handicapper.stripeAccountId;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: session.user.email ?? undefined,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { handicapperId: handicapper.id, handle: handicapper.handle },
      });
      accountId = account.id;
      await prisma.handicapperProfile.update({
        where: { id: handicapper.id },
        data: { stripeAccountId: accountId },
      });
    }
  } catch (error) {
    // Surface the real reason (e.g. "Connect is not enabled" or a missing key)
    // so it's actionable rather than a generic failure.
    console.error("Stripe Connect account creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Couldn't start Stripe onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Ensure Stripe Prices exist for every offered package — they may be
  // missing if Stripe was unavailable at profile creation or a package was
  // just added/changed. Doing it here means that by the time onboarding
  // completes, subscriptions can be enabled.
  try {
    await ensureSubscriberPrices(handicapper);
  } catch (error) {
    console.error("Failed to ensure subscriber prices during Connect setup:", error);
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/handicapper`,
      return_url: `${appUrl}/dashboard/handicapper`,
      type: "account_onboarding",
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe account link creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Couldn't start Stripe onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
