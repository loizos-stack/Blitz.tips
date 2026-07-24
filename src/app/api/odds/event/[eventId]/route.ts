import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventMarkets } from "@/lib/odds-api";
import { SPORT_LABELS } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

// Full categorized market set for one game (game lines + props / soccer extras).
// Handicapper-gated like /api/odds/events, since fetching props spends quota.
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!handicapper) {
    return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });
  }

  const { eventId } = await params;
  const sport = request.nextUrl.searchParams.get("sport") ?? "";
  const sportKey = request.nextUrl.searchParams.get("sportKey") ?? "";
  if (!(sport in SPORT_LABELS)) {
    return NextResponse.json({ error: "Unknown sport" }, { status: 400 });
  }
  if (!eventId || !sportKey) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  const result = await getEventMarkets(sport as PickSport, sportKey, eventId);
  return NextResponse.json(result);
}
