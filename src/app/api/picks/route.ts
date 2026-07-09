import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPickSchema, createParlaySchema } from "@/lib/validations";
import { isEmailVerified } from "@/lib/verification";
import { logActivity } from "@/lib/audit";
import { notifyNewPick } from "@/lib/notifications";
import { combineParlayOdds } from "@/lib/odds";
import type { BetType, PickSport } from "@prisma/client";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json({ error: "Please verify your email before posting picks." }, { status: 403 });
  }

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) {
    return NextResponse.json({ error: "You need a handicapper profile first" }, { status: 403 });
  }
  if (handicapper.suspendedAt) {
    return NextResponse.json({ error: "Your profile is suspended — contact support." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  // Parlays carry a `legs` array; combined odds are computed server-side.
  if (body && Array.isArray(body.legs)) {
    return createParlay(body, handicapper, session.user.email);
  }

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
      oddsApiEventId: parsed.data.oddsApiEventId,
      oddsApiSportKey: parsed.data.oddsApiSportKey,
    },
  });

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "pick.create",
    targetType: "Pick",
    targetId: pick.id,
    detail: `${pick.matchup} — ${pick.selection} @ ${pick.odds}`,
  });

  // Notify the handicapper's followers and subscribers after the response.
  after(() =>
    notifyNewPick({
      id: pick.id,
      matchup: pick.matchup,
      selection: pick.selection,
      odds: pick.odds,
      isPremium: pick.isPremium,
      handicapper: {
        id: handicapper.id,
        userId: handicapper.userId,
        handle: handicapper.handle,
        displayName: handicapper.displayName,
      },
    })
  );

  return NextResponse.json({ pick }, { status: 201 });
}

// Create a PARLAY pick: store each leg and set the parent Pick's odds to the
// combined (multiplied) American odds.
async function createParlay(
  body: unknown,
  handicapper: { id: string; userId: string; handle: string; displayName: string },
  actorEmail: string | null | undefined
) {
  const handicapperId = handicapper.id;
  const actorId = handicapper.userId;
  const parsed = createParlaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid parlay" }, { status: 400 });
  }

  const eventStartsAt = new Date(parsed.data.eventStartsAt);
  if (Number.isNaN(eventStartsAt.getTime())) {
    return NextResponse.json({ error: "Invalid event start time" }, { status: 400 });
  }

  const { legs, sport, units, analysis, isPremium } = parsed.data;
  const combinedOdds = combineParlayOdds(legs.map((l) => l.odds));

  const pick = await prisma.pick.create({
    data: {
      handicapperId,
      sport: sport as PickSport,
      matchup: `${legs.length}-leg parlay`,
      betType: "PARLAY",
      selection: legs.map((l) => l.selection).join(" + "),
      odds: combinedOdds,
      units,
      analysis,
      isPremium,
      eventStartsAt,
      parlayLegs: {
        create: legs.map((l, i) => ({
          sport: (l.sport as PickSport | undefined) ?? null,
          league: l.league ?? null,
          matchup: l.matchup,
          selection: l.selection,
          odds: l.odds,
          order: i,
        })),
      },
    },
    include: { parlayLegs: { orderBy: { order: "asc" } } },
  });

  await logActivity({
    actorId,
    actorEmail,
    action: "pick.create",
    targetType: "Pick",
    targetId: pick.id,
    detail: `${legs.length}-leg parlay @ ${combinedOdds}`,
  });

  after(() =>
    notifyNewPick({
      id: pick.id,
      matchup: pick.matchup,
      selection: `${legs.length}-leg parlay`,
      odds: pick.odds,
      isPremium: pick.isPremium,
      handicapper: {
        id: handicapper.id,
        userId: handicapper.userId,
        handle: handicapper.handle,
        displayName: handicapper.displayName,
      },
    })
  );

  return NextResponse.json({ pick }, { status: 201 });
}
