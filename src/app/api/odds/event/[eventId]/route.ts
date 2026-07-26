import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEventMarkets } from "@/lib/odds-api";
import { SPORT_LABELS } from "@/lib/utils";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { PickSport } from "@prisma/client";

// Full categorized market set for one game (game lines + props / soccer extras).
// Gated to handicappers and contest entrants like /api/odds/events, and rate
// limited, since fetching props spends quota.
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Each call spends upstream odds quota (billed markets x regions), so cap how
  // fast one account can pull per-event markets. Keyed per user, not per IP, so
  // a shared network isn't punished for one abuser.
  const limit = await rateLimit(`odds-event:${session.user.id}`, 60, 300);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const [handicapper, contestEntry] = await Promise.all([
    prisma.handicapperProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    prisma.contestEntry.findFirst({ where: { userId: session.user.id }, select: { id: true } }),
  ]);
  if (!handicapper && !contestEntry) {
    return NextResponse.json({ error: "Handicapper profile or contest entry required" }, { status: 403 });
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
