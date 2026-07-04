import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/site";

const appUrl = siteUrl();

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) return NextResponse.json({ error: "No handicapper profile" }, { status: 404 });

  let accountId = handicapper.stripeAccountId;

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

  // Ensure the subscriber Product/Price exist — they may be missing if Stripe
  // was unavailable when the profile was first created. Doing it here means
  // that by the time onboarding completes, subscriptions can be enabled.
  if (!handicapper.stripePriceId) {
    try {
      const productId =
        handicapper.stripeProductId ??
        (
          await stripe.products.create({
            name: `Blitz.tips — ${handicapper.displayName}`,
            metadata: { handle: handicapper.handle },
          })
        ).id;
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: handicapper.monthlyPriceCents,
        currency: "usd",
        recurring: { interval: "month" },
      });
      await prisma.handicapperProfile.update({
        where: { id: handicapper.id },
        data: { stripeProductId: productId, stripePriceId: price.id },
      });
    } catch (error) {
      console.error("Failed to ensure subscriber price during Connect setup:", error);
    }
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/handicapper`,
    return_url: `${appUrl}/dashboard/handicapper`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
