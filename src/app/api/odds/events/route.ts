import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingEvents } from "@/lib/odds-api";
import { SPORT_LABELS } from "@/lib/utils";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import type { PickSport } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // The board feed spends upstream quota too (it's cached per sport, but a
  // cache-miss sport still costs), so throttle per account.
  const limit = await rateLimit(`odds-feed:${session.user.id}`, 120, 300);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  // Pulling the feed spends API quota, so it's limited to people who post picks:
  // handicappers, and contest entrants (who pick from the same board).
  const [handicapper, contestEntry] = await Promise.all([
    prisma.handicapperProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    prisma.contestEntry.findFirst({ where: { userId: session.user.id }, select: { id: true } }),
  ]);
  if (!handicapper && !contestEntry) {
    return NextResponse.json({ error: "Handicapper profile or contest entry required" }, { status: 403 });
  }

  const sport = request.nextUrl.searchParams.get("sport") ?? "";
  if (!(sport in SPORT_LABELS)) {
    return NextResponse.json({ error: "Unknown sport" }, { status: 400 });
  }

  const feed = await getUpcomingEvents(sport as PickSport);
  // Exclude games that have already started — a handicapper shouldn't be able to
  // post a tip on a game in progress. (The public board keeps showing in-progress
  // games; this endpoint feeds only the pick/parlay forms.)
  const now = Date.now();
  const events = feed.events.filter((e) => new Date(e.commenceTime).getTime() > now);
  return NextResponse.json({ ...feed, events });
}
