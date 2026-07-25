import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createContestPickSchema } from "@/lib/validations";
import { isContestAcceptingPicks } from "@/lib/contest";
import { getUpcomingEvents, getEventMarkets } from "@/lib/odds-api";
import {
  MAX_PICKS_PER_DAY,
  MAX_PICKS_PER_WEEK,
  MAX_UNITS_PER_DAY,
  startOfUtcDay,
  startOfUtcWeek,
} from "@/lib/contest-limits";
import { SPORT_LABELS } from "@/lib/utils";
import { clientMeta } from "@/lib/request-meta";
import { logActivity } from "@/lib/audit";
import type { PickSport, BetType } from "@prisma/client";

// Submit a pick into a contest. Requires an existing entry, the contest to be
// accepting picks, and a future (in-window) start time so nobody can post on a
// game that already kicked off.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });

  const entry = await prisma.contestEntry.findUnique({
    where: { contestId_userId: { contestId: id, userId: session.user.id } },
  });
  if (!entry) return NextResponse.json({ error: "Enter the contest first." }, { status: 403 });

  if (!isContestAcceptingPicks(contest)) {
    return NextResponse.json({ error: "This contest isn't accepting picks right now." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createContestPickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const sport = parsed.data.sport;
  if (!(sport in SPORT_LABELS)) {
    return NextResponse.json({ error: "Pick a valid sport" }, { status: 400 });
  }

  // Contest picks must come off our own board — entrants never supply a price.
  // Resolve the game from the live feed, then confirm the exact selection is
  // still offered at the exact odds claimed. Everything stored below comes from
  // the feed, not the request body, so a crafted payload can't invent a line,
  // a price, or a start time.
  const feed = await getUpcomingEvents(sport as PickSport);
  if (!feed.configured) {
    return NextResponse.json({ error: "Live odds are unavailable right now — try again shortly." }, { status: 503 });
  }
  const event = feed.events.find((e) => e.id === parsed.data.oddsApiEventId);
  if (!event) {
    return NextResponse.json(
      { error: "That game is no longer on the board. Refresh and pick again." },
      { status: 400 }
    );
  }

  const eventStartsAt = new Date(event.commenceTime);
  if (eventStartsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This game has already started — you can't post a pick on it." },
      { status: 400 }
    );
  }
  if (eventStartsAt > contest.endsAt) {
    return NextResponse.json({ error: "That game is after the contest ends." }, { status: 400 });
  }

  // Verify the line against the event's full market set (cached, so this is
  // usually free). Matching on selection + price means the entrant can only
  // store a line we actually published.
  const markets = await getEventMarkets(sport as PickSport, event.sportKey, event.id);
  const offered = [
    ...event.markets,
    ...markets.groups.flatMap((g) => g.sections.flatMap((s) => s.options)),
  ];
  const chosen = offered.find(
    (o) => o.selection === parsed.data.selection && o.odds === parsed.data.odds
  );
  if (!chosen) {
    return NextResponse.json(
      { error: "That line has moved or is no longer offered. Refresh the game and pick again." },
      { status: 409 }
    );
  }

  // Enforce the daily/weekly quotas (counted by submission time, UTC windows).
  const dayStart = startOfUtcDay();
  const weekStart = startOfUtcWeek();
  const [todayAgg, weekCount] = await Promise.all([
    prisma.contestPick.aggregate({
      where: { entryId: entry.id, createdAt: { gte: dayStart } },
      _count: true,
      _sum: { units: true },
    }),
    prisma.contestPick.count({ where: { entryId: entry.id, createdAt: { gte: weekStart } } }),
  ]);
  const picksToday = todayAgg._count;
  const unitsToday = todayAgg._sum.units ?? 0;

  if (picksToday >= MAX_PICKS_PER_DAY) {
    return NextResponse.json(
      { error: `Daily limit reached — ${MAX_PICKS_PER_DAY} picks per day. Resets at midnight UTC.` },
      { status: 400 }
    );
  }
  if (weekCount >= MAX_PICKS_PER_WEEK) {
    return NextResponse.json(
      { error: `Weekly limit reached — ${MAX_PICKS_PER_WEEK} picks per week. Resets Monday.` },
      { status: 400 }
    );
  }
  if (unitsToday + parsed.data.units > MAX_UNITS_PER_DAY) {
    const left = Math.max(0, Math.round((MAX_UNITS_PER_DAY - unitsToday) * 100) / 100);
    return NextResponse.json(
      {
        error: `That would exceed your ${MAX_UNITS_PER_DAY}-unit daily limit — you have ${left}u left today.`,
      },
      { status: 400 }
    );
  }

  const pick = await prisma.contestPick.create({
    data: {
      entryId: entry.id,
      sport: sport as PickSport,
      // Matchup, selection, price, bet type and start time are all taken from
      // the verified board entry rather than the request body.
      matchup: event.matchup,
      selection: chosen.selection,
      betType: chosen.betType as BetType,
      odds: chosen.odds,
      units: parsed.data.units,
      eventStartsAt,
      oddsApiEventId: event.id,
      oddsApiSportKey: event.sportKey,
    },
  });

  // Anti-fraud signal: record the IP + device used for this pick (best-effort).
  const { ip, userAgent } = clientMeta(request);
  if (ip) {
    await prisma.contestIpLog
      .create({ data: { contestId: id, entryId: entry.id, userId: session.user.id, ip, userAgent, action: "pick" } })
      .catch(() => undefined);
  }

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "contest.pick",
    targetType: "ContestPick",
    targetId: pick.id,
    detail: `${pick.matchup} — ${pick.selection} @ ${pick.odds}`,
  });

  return NextResponse.json({ pick }, { status: 201 });
}
