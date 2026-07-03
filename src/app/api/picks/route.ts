import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPickSchema } from "@/lib/validations";
import type { BetType, PickSport } from "@prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) {
    return NextResponse.json({ error: "You need a handicapper profile first" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createPickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const eventStartsAt = new Date(parsed.data.eventStartsAt);
  if (Number.isNaN(eventStartsAt.getTime())) {
    return NextResponse.json({ error: "Invalid event start time" }, { status: 400 });
  }

  const pick = await prisma.pick.create({
    data: {
      handicapperId: handicapper.id,
      sport: parsed.data.sport as PickSport,
      league: parsed.data.league,
      matchup: parsed.data.matchup,
      betType: parsed.data.betType as BetType,
      selection: parsed.data.selection,
      odds: parsed.data.odds,
      units: parsed.data.units,
      analysis: parsed.data.analysis,
      isPremium: parsed.data.isPremium,
      eventStartsAt,
    },
  });

  return NextResponse.json({ pick }, { status: 201 });
}
