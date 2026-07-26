import "server-only";
import { prisma } from "@/lib/prisma";
import { computeStandings, effectivePrizeLadderCents, activeEntrantCount } from "@/lib/contest";
import type { PickSport } from "@prisma/client";

/**
 * Where the contest field is betting.
 *
 * The differentiator over a public betting-consensus page is who's in the
 * sample: not anonymous tickets, but entrants building a graded, public record
 * with $25,000 on the line. And because we know each entrant's standing, the
 * field can be split — what everyone is on, versus what the entrants who have
 * actually qualified are on. Those two disagreeing is the interesting signal;
 * one number alone is just a crowd.
 *
 * Only pending picks on games that haven't started are counted: once a game is
 * underway the split stops being a prediction and becomes trivia.
 */

/** Below this many picks a split is noise, not consensus, and the game is hidden. */
export const MIN_PICKS_FOR_CONSENSUS = 3;

/**
 * Qualified entrants needed before their split is shown separately.
 *
 * Without this, one qualified entrant on a game renders as "100% qualified" and
 * fires the fade badge — dressing up a single person's pick as the verdict of
 * the proven subset. Below the floor the qualified bar and badge are suppressed
 * and only the field split shows.
 */
export const MIN_QUALIFIED_FOR_SPLIT = 3;

export interface ConsensusSide {
  selection: string;
  /** Median-ish representative price — the odds most entrants got. */
  odds: number;
  picks: number;
  units: number;
  /** Share of this game's picks, 0-100. */
  pickShare: number;
  /** Share of this game's staked units, 0-100. */
  unitShare: number;
  /** Picks from entrants who have met the qualifying pick floor. */
  qualifiedPicks: number;
  /** Share among qualified entrants only, 0-100; null when none are on the game. */
  qualifiedShare: number | null;
}

export interface ConsensusGame {
  eventId: string;
  sport: PickSport;
  matchup: string;
  startsAt: Date;
  totalPicks: number;
  totalUnits: number;
  qualifiedTotal: number;
  sides: ConsensusSide[];
  /**
   * True when the field's favourite side is not the qualified entrants'
   * favourite — i.e. the proven subset is fading the crowd.
   */
  split: boolean;
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

export async function contestConsensus(): Promise<{ games: ConsensusGame[]; entrants: number } | null> {
  const contest = await prisma.contest.findUnique({
    where: { slug: "supercapper" },
    include: {
      entries: { include: { picks: true, user: { select: { name: true, username: true } } } },
    },
  });
  if (!contest) return null;

  // Which entrants have qualified, so their picks can be counted separately.
  const prizeLadder = effectivePrizeLadderCents(contest, activeEntrantCount(contest.entries));
  const qualifiedEntryIds = new Set(
    computeStandings(contest.entries, { minPicks: contest.minPicks, prizeSplitCents: prizeLadder })
      .filter((s) => s.qualified)
      .map((s) => s.entryId)
  );

  const now = Date.now();
  const byEvent = new Map<
    string,
    {
      sport: PickSport;
      matchup: string;
      startsAt: Date;
      sides: Map<string, { odds: number[]; picks: number; units: number; qualifiedPicks: number }>;
    }
  >();

  for (const entry of contest.entries) {
    if (entry.disqualifiedAt) continue;
    const isQualified = qualifiedEntryIds.has(entry.id);

    for (const pick of entry.picks) {
      // Pending, not yet started, and off the board (so we can group by event).
      if (pick.result !== "PENDING") continue;
      if (pick.eventStartsAt.getTime() <= now) continue;
      if (!pick.oddsApiEventId) continue;

      const game =
        byEvent.get(pick.oddsApiEventId) ??
        {
          sport: pick.sport,
          matchup: pick.matchup,
          startsAt: pick.eventStartsAt,
          sides: new Map<string, { odds: number[]; picks: number; units: number; qualifiedPicks: number }>(),
        };
      const side = game.sides.get(pick.selection) ?? { odds: [], picks: 0, units: 0, qualifiedPicks: 0 };
      side.odds.push(pick.odds);
      side.picks += 1;
      side.units += pick.units;
      if (isQualified) side.qualifiedPicks += 1;
      game.sides.set(pick.selection, side);
      byEvent.set(pick.oddsApiEventId, game);
    }
  }

  const games: ConsensusGame[] = [];
  for (const [eventId, game] of byEvent) {
    const totalPicks = [...game.sides.values()].reduce((n, s) => n + s.picks, 0);
    if (totalPicks < MIN_PICKS_FOR_CONSENSUS) continue;

    const totalUnits = [...game.sides.values()].reduce((n, s) => n + s.units, 0);
    const qualifiedTotal = [...game.sides.values()].reduce((n, s) => n + s.qualifiedPicks, 0);
    const showQualified = qualifiedTotal >= MIN_QUALIFIED_FOR_SPLIT;

    const sides: ConsensusSide[] = [...game.sides.entries()]
      .map(([selection, s]) => ({
        selection,
        // The middle price rather than the mean — one entrant who caught a
        // stale number shouldn't move the quoted line.
        odds: [...s.odds].sort((a, b) => a - b)[Math.floor(s.odds.length / 2)]!,
        picks: s.picks,
        units: Math.round(s.units * 100) / 100,
        pickShare: pct(s.picks, totalPicks),
        unitShare: pct(s.units, totalUnits),
        qualifiedPicks: s.qualifiedPicks,
        qualifiedShare: showQualified ? pct(s.qualifiedPicks, qualifiedTotal) : null,
      }))
      .sort((a, b) => b.picks - a.picks || b.units - a.units);

    // Does the qualified subset lead with a different side than the field?
    const fieldTop = sides[0]!.selection;
    const qualifiedTop = showQualified
      ? [...sides].sort((a, b) => b.qualifiedPicks - a.qualifiedPicks)[0]!.selection
      : null;

    games.push({
      eventId,
      sport: game.sport,
      matchup: game.matchup,
      startsAt: game.startsAt,
      totalPicks,
      totalUnits: Math.round(totalUnits * 100) / 100,
      qualifiedTotal,
      sides,
      split: Boolean(qualifiedTop && qualifiedTop !== fieldTop),
    });
  }

  // Most-backed games first; ties break on the earlier kickoff.
  games.sort((a, b) => b.totalPicks - a.totalPicks || a.startsAt.getTime() - b.startsAt.getTime());

  return { games, entrants: activeEntrantCount(contest.entries) };
}
