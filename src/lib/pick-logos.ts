import "server-only";
import type { Pick as PickModel, ParlayLeg } from "@prisma/client";
import type { PickSport } from "@prisma/client";
import { parseMatchupSides } from "@/lib/utils";
import { resolveTeamLogo } from "@/lib/sportsdb";

// Server-side crest resolution for stored picks. Pick rows only carry the
// matchup text, so we parse the two sides back out and resolve each side's
// logo (ESPN for US leagues, TheSportsDB for the rest). Lookups are memoized by
// the underlying fetch cache, so a team shared across many picks resolves once.

export interface Crests {
  awayTeamLogo: string | null;
  homeTeamLogo: string | null;
}

const EMPTY: Crests = { awayTeamLogo: null, homeTeamLogo: null };

async function crestsFor(sport: PickSport, matchup: string): Promise<Crests> {
  const sides = parseMatchupSides(matchup);
  if (!sides) return EMPTY;
  const [awayTeamLogo, homeTeamLogo] = await Promise.all([
    resolveTeamLogo(sport, sides.awayTeam),
    resolveTeamLogo(sport, sides.homeTeam),
  ]);
  return { awayTeamLogo, homeTeamLogo };
}

type LegInput = Pick<ParlayLeg, "id" | "matchup" | "selection" | "odds">;
type PickInput = PickModel & { parlayLegs?: LegInput[] };

export type CrestLeg = LegInput & Crests;
export type PickWithCrests<T> = T & Crests & { parlayLegs: CrestLeg[] | undefined };

/**
 * Attach resolved crests to each pick (and each parlay leg). Preserves any
 * extra fields already on the pick (e.g. an included `handicapper`).
 */
export async function enrichPickCrests<T extends PickInput>(
  picks: T[]
): Promise<PickWithCrests<T>[]> {
  return Promise.all(
    picks.map(async (pick) => {
      const [own, legs] = await Promise.all([
        crestsFor(pick.sport, pick.matchup),
        pick.parlayLegs
          ? Promise.all(
              pick.parlayLegs.map(async (leg) => ({
                ...leg,
                ...(await crestsFor(pick.sport, leg.matchup)),
              }))
            )
          : Promise.resolve(undefined),
      ]);
      return { ...pick, ...own, parlayLegs: legs } as PickWithCrests<T>;
    })
  );
}
