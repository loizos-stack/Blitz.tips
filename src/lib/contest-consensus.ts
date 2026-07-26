import "server-only";
import { prisma } from "@/lib/prisma";
import { computeStandings, effectivePrizeLadderCents, activeEntrantCount } from "@/lib/contest";
import { marketLabel } from "@/lib/odds-markets";
import { resolveTeamLogo } from "@/lib/sportsdb";
import { parseMatchupSides } from "@/lib/utils";
import { SPORT_LABELS } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

/**
 * Where the contest field is betting, as league -> match -> market.
 *
 * The differentiator over a public betting-consensus page is who's in the
 * sample: not anonymous tickets, but entrants building a graded, public record
 * with $10,000 on the line. And because we know each entrant's standing, the
 * field can be split — what everyone is on, versus what the entrants who have
 * actually qualified are on. Those two disagreeing is the interesting signal;
 * one number alone is just a crowd.
 *
 * Every pending pick is shown, however thin. Shares are per market rather than
 * per game, so a spread and a player prop on the same match aren't averaged
 * into one meaningless percentage.
 *
 * Only pending picks on games that haven't started are counted: once a game is
 * underway the split stops being a prediction and becomes trivia.
 */

/**
 * Qualified entrants needed before their split is shown separately.
 *
 * Without this, one qualified entrant on a market renders as "100% qualified"
 * and fires the fade badge — dressing up a single person's pick as the verdict
 * of the proven subset. Below the floor the qualified bar and badge are
 * suppressed and only the field split shows.
 */
export const MIN_QUALIFIED_FOR_SPLIT = 3;

export interface ConsensusSide {
  selection: string;
  /** Median price — the odds most entrants actually got. */
  odds: number;
  picks: number;
  units: number;
  /** Share of this market's picks, 0-100. */
  pickShare: number;
  /** Share of this market's staked units, 0-100. */
  unitShare: number;
  qualifiedPicks: number;
  /** Share among qualified entrants only; null below MIN_QUALIFIED_FOR_SPLIT. */
  qualifiedShare: number | null;
}

export interface ConsensusMarket {
  key: string;
  label: string;
  totalPicks: number;
  totalUnits: number;
  qualifiedTotal: number;
  sides: ConsensusSide[];
  /** The qualified entrants' most-backed side isn't the field's. */
  split: boolean;
}

export interface ConsensusGame {
  eventId: string;
  sport: PickSport;
  matchup: string;
  /**
   * Resolved crests. ESPN covers the US majors; soccer and the rest come from
   * TheSportsDB, which is why this is resolved here rather than from the
   * synchronous lookup the component falls back to.
   */
  awayLogo: string | null;
  homeLogo: string | null;
  startsAt: Date;
  totalPicks: number;
  totalUnits: number;
  markets: ConsensusMarket[];
  /** Any market on this game where the qualified subset fades the field. */
  hasSplit: boolean;
}

export interface ConsensusLeague {
  sport: PickSport;
  label: string;
  totalPicks: number;
  games: ConsensusGame[];
}

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface SideAgg {
  odds: number[];
  picks: number;
  units: number;
  qualifiedPicks: number;
}
interface MarketAgg {
  label: string;
  sides: Map<string, SideAgg>;
}
interface GameAgg {
  sport: PickSport;
  matchup: string;
  startsAt: Date;
  markets: Map<string, MarketAgg>;
}

export async function contestConsensus(): Promise<{
  leagues: ConsensusLeague[];
  entrants: number;
  totalPicks: number;
  games: number;
} | null> {
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
  const byEvent = new Map<string, GameAgg>();

  for (const entry of contest.entries) {
    if (entry.disqualifiedAt) continue;
    const isQualified = qualifiedEntryIds.has(entry.id);

    for (const pick of entry.picks) {
      if (pick.result !== "PENDING") continue;
      if (pick.eventStartsAt.getTime() <= now) continue;
      if (!pick.oddsApiEventId) continue;

      const game =
        byEvent.get(pick.oddsApiEventId) ??
        ({
          sport: pick.sport,
          matchup: pick.matchup,
          startsAt: pick.eventStartsAt,
          markets: new Map<string, MarketAgg>(),
        } satisfies GameAgg);

      // Player props are keyed per player, so two players' points lines don't
      // collapse into one "Points" bucket where the shares would be nonsense.
      const base = pick.marketKey ?? pick.betType;
      const key = pick.playerName ? `${base}::${pick.playerName}` : base;
      const label = pick.playerName
        ? `${pick.playerName} — ${marketLabel(pick.marketKey, pick.betType)}`
        : marketLabel(pick.marketKey, pick.betType);

      const market = game.markets.get(key) ?? { label, sides: new Map<string, SideAgg>() };
      const side = market.sides.get(pick.selection) ?? { odds: [], picks: 0, units: 0, qualifiedPicks: 0 };
      side.odds.push(pick.odds);
      side.picks += 1;
      side.units += pick.units;
      if (isQualified) side.qualifiedPicks += 1;
      market.sides.set(pick.selection, side);
      game.markets.set(key, market);
      byEvent.set(pick.oddsApiEventId, game);
    }
  }

  const games: ConsensusGame[] = [];
  for (const [eventId, game] of byEvent) {
    const markets: ConsensusMarket[] = [];

    for (const [key, market] of game.markets) {
      const aggs = [...market.sides.values()];
      const totalPicks = aggs.reduce((n, s) => n + s.picks, 0);
      const totalUnits = aggs.reduce((n, s) => n + s.units, 0);
      const qualifiedTotal = aggs.reduce((n, s) => n + s.qualifiedPicks, 0);
      const showQualified = qualifiedTotal >= MIN_QUALIFIED_FOR_SPLIT;

      const sides: ConsensusSide[] = [...market.sides.entries()]
        .map(([selection, s]) => ({
          selection,
          // The middle price rather than the mean — one entrant who caught a
          // stale number shouldn't move the quoted line.
          odds: [...s.odds].sort((a, b) => a - b)[Math.floor(s.odds.length / 2)]!,
          picks: s.picks,
          units: round2(s.units),
          pickShare: pct(s.picks, totalPicks),
          unitShare: pct(s.units, totalUnits),
          qualifiedPicks: s.qualifiedPicks,
          qualifiedShare: showQualified ? pct(s.qualifiedPicks, qualifiedTotal) : null,
        }))
        .sort((a, b) => b.picks - a.picks || b.units - a.units);

      const qualifiedTop = showQualified
        ? [...sides].sort((a, b) => b.qualifiedPicks - a.qualifiedPicks)[0]!.selection
        : null;

      markets.push({
        key,
        label: market.label,
        totalPicks,
        totalUnits: round2(totalUnits),
        qualifiedTotal,
        sides,
        split: Boolean(qualifiedTop && qualifiedTop !== sides[0]!.selection),
      });
    }

    // Busiest market first — that's the one the page is really about.
    markets.sort((a, b) => b.totalPicks - a.totalPicks || a.label.localeCompare(b.label));

    games.push({
      eventId,
      sport: game.sport,
      matchup: game.matchup,
      awayLogo: null,
      homeLogo: null,
      startsAt: game.startsAt,
      totalPicks: markets.reduce((n, m) => n + m.totalPicks, 0),
      totalUnits: round2(markets.reduce((n, m) => n + m.totalUnits, 0)),
      markets,
      hasSplit: markets.some((m) => m.split),
    });
  }

  // Crests, once per game. The underlying lookups are memoized by the fetch
  // cache, so teams shared across games resolve once; any failure returns null
  // and the component falls back to the sport icon.
  await Promise.all(
    games.map(async (game) => {
      const sides = parseMatchupSides(game.matchup);
      if (!sides) return;
      const [awayLogo, homeLogo] = await Promise.all([
        resolveTeamLogo(game.sport, sides.awayTeam),
        resolveTeamLogo(game.sport, sides.homeTeam),
      ]);
      game.awayLogo = awayLogo;
      game.homeLogo = homeLogo;
    })
  );

  // League -> match. Leagues by volume; matches inside by kickoff, so the page
  // reads like a schedule rather than a ranking.
  const byLeague = new Map<PickSport, ConsensusGame[]>();
  for (const game of games) {
    byLeague.set(game.sport, [...(byLeague.get(game.sport) ?? []), game]);
  }

  const leagues: ConsensusLeague[] = [...byLeague.entries()]
    .map(([sport, list]) => ({
      sport,
      label: SPORT_LABELS[sport] ?? sport,
      totalPicks: list.reduce((n, g) => n + g.totalPicks, 0),
      games: [...list].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    }))
    .sort((a, b) => b.totalPicks - a.totalPicks || a.label.localeCompare(b.label));

  return {
    leagues,
    entrants: activeEntrantCount(contest.entries),
    totalPicks: games.reduce((n, g) => n + g.totalPicks, 0),
    games: games.length,
  };
}
