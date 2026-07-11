import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureSubscriberPrices } from "@/lib/subscriber-pricing";
import { updatePricingSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = updatePricingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { monthlyPriceCents, weeklyPriceCents, annualPriceCents, subscriptionTrialDays } = parsed.data;
  // Store 0/absent as null (no trial).
  const trialDays = subscriptionTrialDays ? subscriptionTrialDays : null;

  // Stripe Prices are immutable — when an amount changes (or a package is
  // dropped) clear the stored price id so ensureSubscriberPrices creates a
  // fresh Price for the new amount. Existing subscribers keep billing on the
  // Price they signed up with; only new checkouts use the new one.
  let updated = await prisma.handicapperProfile.update({
    where: { id: profile.id },
    data: {
      monthlyPriceCents,
      weeklyPriceCents: weeklyPriceCents ?? null,
      annualPriceCents: annualPriceCents ?? null,
      subscriptionTrialDays: trialDays,
      ...(monthlyPriceCents !== profile.monthlyPriceCents && { stripePriceId: null }),
      ...((weeklyPriceCents ?? null) !== profile.weeklyPriceCents && { stripeWeeklyPriceId: null }),
      ...((annualPriceCents ?? null) !== profile.annualPriceCents && { stripeAnnualPriceId: null }),
    },
  });

  try {
    updated = await ensureSubscriberPrices(updated);
  } catch (error) {
    // Saved locally; Stripe prices get created at Connect setup or checkout.
    console.error("Stripe price refresh failed after pricing update:", error);
  }

  return NextResponse.json({
    monthlyPriceCents: updated.monthlyPriceCents,
    weeklyPriceCents: updated.weeklyPriceCents,
    annualPriceCents: updated.annualPriceCents,
  });
}
