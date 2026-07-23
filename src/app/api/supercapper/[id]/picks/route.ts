import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createContestPickSchema } from "@/lib/validations";
import { isContestAcceptingPicks } from "@/lib/contest";
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
import type { PickSport } from "@prisma/client";

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

  if (!(parsed.data.sport in SPORT_LABELS)) {
    return NextResponse.json({ error: "Pick a valid sport" }, { status: 400 });
  }

  const eventStartsAt = new Date(parsed.data.eventStartsAt);
  if (Number.isNaN(eventStartsAt.getTime())) {
    return NextResponse.json({ error: "Invalid event start time" }, { status: 400 });
  }
  if (eventStartsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This game has already started — you can't post a pick on it." },
      { status: 400 }
    );
  }
  if (eventStartsAt > contest.endsAt) {
    return NextResponse.json({ error: "That game is after the contest ends." }, { status: 400 });
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
      sport: parsed.data.sport as PickSport,
      league: parsed.data.league,
      matchup: parsed.data.matchup,
      selection: parsed.data.selection,
      odds: parsed.data.odds,
      units: parsed.data.units,
      eventStartsAt,
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
