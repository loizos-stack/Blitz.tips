import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingEvents } from "@/lib/odds-api";
import { SPORT_LABELS } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Only handicappers can pull the feed — it's what spends the API quota.
  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!handicapper) {
    return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });
  }

  const sport = request.nextUrl.searchParams.get("sport") ?? "";
  if (!(sport in SPORT_LABELS)) {
    return NextResponse.json({ error: "Unknown sport" }, { status: 400 });
  }

  const feed = await getUpcomingEvents(sport as PickSport);
  return NextResponse.json(feed);
}
