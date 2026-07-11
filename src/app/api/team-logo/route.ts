import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveTeamLogo } from "@/lib/sportsdb";
import { SPORT_LABELS } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

// Resolve a single team/fighter crest by name (ESPN for US leagues, TheSportsDB
// for the rest) so the posting forms can preview logos as a handicapper types.
// Gated to handicappers since it can spend the SportsDB quota.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ url: null }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!handicapper) return NextResponse.json({ url: null }, { status: 403 });

  const sport = request.nextUrl.searchParams.get("sport") ?? "";
  const name = (request.nextUrl.searchParams.get("name") ?? "").trim();
  if (!name || !(sport in SPORT_LABELS)) return NextResponse.json({ url: null });

  const url = await resolveTeamLogo(sport as PickSport, name);
  return NextResponse.json({ url });
}
