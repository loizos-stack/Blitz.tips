import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/handicapper`,
    return_url: `${appUrl}/dashboard/handicapper`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
