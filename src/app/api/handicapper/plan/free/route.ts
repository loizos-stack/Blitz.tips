import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) return NextResponse.json({ error: "No handicapper profile" }, { status: 404 });

  if (handicapper.plan === "FREE") {
    return NextResponse.json({ error: "Already on the Free plan" }, { status: 409 });
  }

  // Switching to Free takes effect immediately — cancel the paid plan
  // subscription now rather than at period end, since there's nothing left
  // to bill for once the commission rate reverts.
  if (handicapper.planStripeSubscriptionId) {
    await stripe.subscriptions.cancel(handicapper.planStripeSubscriptionId).catch(() => undefined);
  }

  await prisma.handicapperProfile.update({
    where: { id: handicapper.id },
    data: {
      plan: "FREE",
      planInterval: null,
      planStatus: "ACTIVE",
      planStripeSubscriptionId: null,
      planCurrentPeriodEnd: null,
      planCancelAtPeriodEnd: false,
    },
  });

  return NextResponse.json({ ok: true });
}
