import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureSubscriberPrices } from "@/lib/subscriber-pricing";
import { becomeHandicapperSchema, updateSportsSchema } from "@/lib/validations";
import { logActivity } from "@/lib/audit";
import { SPORT_LABELS } from "@/lib/utils";
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

  const { handle, displayName, bio, sports, monthlyPriceCents, weeklyPriceCents, annualPriceCents } =
    parsed.data;

  let handicapper = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { role: "HANDICAPPER" } });
    return tx.handicapperProfile.create({
      data: {
        userId: session.user.id,
        handle,
        displayName,
        bio,
        sports: sports as PickSport[],
        monthlyPriceCents,
        weeklyPriceCents: weeklyPriceCents ?? null,
        annualPriceCents: annualPriceCents ?? null,
      },
    });
  });

  // Best-effort Stripe Product/Price setup — a Stripe hiccup must not block
  // profile creation (they can still post picks). Prices are (re)created
  // lazily at Connect setup or checkout; the subscribe button stays disabled
  // until prices + stripeAccountReady exist.
  try {
    handicapper = await ensureSubscriberPrices(handicapper);
  } catch (error) {
    console.error("Stripe price setup failed during handicapper signup; deferring:", error);
  }

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "handicapper.create",
    targetType: "HandicapperProfile",
    targetId: handicapper.id,
    detail: `@${handicapper.handle} became a handicapper`,
  });

  return NextResponse.json({ handicapper }, { status: 201 });
}

// Update the sports a handicapper covers (the profile tab's sports editor).
// These drive where the handicapper is searchable and ranked.
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) {
    return NextResponse.json({ error: "You need a handicapper profile first" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSportsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Keep only known sports and drop duplicates before writing the enum array.
  const valid = new Set(Object.keys(SPORT_LABELS));
  const sports = [...new Set(parsed.data.sports)].filter((s) => valid.has(s)) as PickSport[];
  if (sports.length === 0) {
    return NextResponse.json({ error: "Pick at least one valid sport" }, { status: 400 });
  }

  const updated = await prisma.handicapperProfile.update({
    where: { id: handicapper.id },
    data: { sports },
  });

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "handicapper.update",
    targetType: "HandicapperProfile",
    targetId: handicapper.id,
    detail: `Updated covered sports: ${sports.join(", ")}`,
  });

  return NextResponse.json({ handicapper: updated });
}
