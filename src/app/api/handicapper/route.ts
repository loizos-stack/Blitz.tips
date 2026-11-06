import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { notifyAdmins } from "@/lib/admin-alerts";
import { prisma } from "@/lib/prisma";
import { ensureSubscriberPrices } from "@/lib/subscriber-pricing";
import { becomeHandicapperSchema } from "@/lib/validations";
import { logActivity } from "@/lib/audit";

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

  const { handle, displayName, bio, monthlyPriceCents, weeklyPriceCents, annualPriceCents } =
    parsed.data;

  let handicapper = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { role: "HANDICAPPER" } });
    return tx.handicapperProfile.create({
      data: {
        userId: session.user.id,
        handle,
        displayName,
        bio,
        // No sports here. Which sports a handicapper covers is read off the
        // picks they post (lib/handicappers → sportsFromPicks), so a brand new
        // profile covers nothing until it has posted something — which is the
        // honest answer, and what keeps the sport filters free of people who
        // have never posted in that sport.
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

  after(() =>
    notifyAdmins({
      kind: "signup.handicapper",
      title: `New handicapper: @${handicapper.handle}`,
      details: [
        ["Name", handicapper.displayName],
        ["Handle", `@${handicapper.handle}`],
        ["Email", session.user.email ?? "—"],
        ["Monthly", `${(handicapper.monthlyPriceCents / 100).toFixed(2)}`],
      ],
      path: "/admin/handicappers",
    })
  );

  return NextResponse.json({ handicapper }, { status: 201 });
}
