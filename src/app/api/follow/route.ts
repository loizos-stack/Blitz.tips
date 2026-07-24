import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

// The current user's follow set — powers the Follow buttons' initial state.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ signedIn: false, handicapperIds: [] });

  const follows = await prisma.follow.findMany({
    where: { followerId: session.user.id },
    select: { handicapperId: true },
  });
  return NextResponse.json({ signedIn: true, handicapperIds: follows.map((f) => f.handicapperId) });
}

// Follow or unfollow a handicapper. Following is free and independent of any
// paid subscription.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const handicapperId = typeof body.handicapperId === "string" ? body.handicapperId : "";
  const follow = Boolean(body.follow);
  if (!handicapperId) return NextResponse.json({ error: "Missing handicapper" }, { status: 400 });

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { id: handicapperId },
    select: { id: true, handle: true, suspendedAt: true },
  });
  if (!handicapper || handicapper.suspendedAt) {
    return NextResponse.json({ error: "Handicapper not found" }, { status: 404 });
  }

  if (follow) {
    await prisma.follow.upsert({
      where: { followerId_handicapperId: { followerId: session.user.id, handicapperId } },
      create: { followerId: session.user.id, handicapperId },
      update: {},
    });
  } else {
    await prisma.follow
      .delete({
        where: { followerId_handicapperId: { followerId: session.user.id, handicapperId } },
      })
      .catch(() => null); // Already not following — treat as success.
  }

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: follow ? "follow.add" : "follow.remove",
    targetType: "HandicapperProfile",
    targetId: handicapperId,
    detail: handicapper.handle,
  });

  return NextResponse.json({ ok: true, following: follow });
}
