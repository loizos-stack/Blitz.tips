import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { becomeHandicapperSchema } from "@/lib/validations";
import type { PickSport } from "@prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = becomeHandicapperSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existingProfile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (existingProfile) {
    return NextResponse.json({ error: "You already have a handicapper profile" }, { status: 409 });
  }

  const handleTaken = await prisma.handicapperProfile.findUnique({ where: { handle: parsed.data.handle } });
  if (handleTaken) {
    return NextResponse.json({ error: "That handle is already taken" }, { status: 409 });
  }

  const { handle, displayName, bio, sports, monthlyPriceCents } = parsed.data;

  const product = await stripe.products.create({
    name: `Blitz.tips — ${displayName}`,
    metadata: { handle },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: monthlyPriceCents,
    currency: "usd",
    recurring: { interval: "month" },
  });

  const handicapper = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { role: "HANDICAPPER" } });
    return tx.handicapperProfile.create({
      data: {
        userId: session.user.id,
        handle,
        displayName,
        bio,
        sports: sports as PickSport[],
        monthlyPriceCents,
        stripeProductId: product.id,
        stripePriceId: price.id,
      },
    });
  });

  return NextResponse.json({ handicapper }, { status: 201 });
}
