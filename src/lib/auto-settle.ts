import "server-only";
import { prisma } from "@/lib/prisma";
import { oddsApiKey } from "@/lib/odds-api";
import {
  getFinalPeriodScores,
  getPlayerStats,
  livePairKey,
  fighterKey,
  type PeriodScores,
  type StatLine,
} from "@/lib/espn-scores";
import type { PickResult, PickSport } from "@prisma/client";

const API_BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

// The Odds API's /scores endpoint covers at most the last 3 days; older
// unsettled picks stay for manual grading.
const DAYS_FROM = 3;

interface ScoreEntry {
  id: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

interface FinalScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Grade one pick against a final score. Returns null when the selection can't
 * be interpreted confidently — never guess a result on the record.
 */
export function gradePick(
  pick: { betType: string; selection: string },
  score: FinalScore
): PickResult | null {
  const { homeTeam, awayTeam, homeScore, awayScore } = score;

  if (pick.betType === "TOTAL") {
    const m = pick.selection.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)/i);
    if (!m) return null;
    const line = parseFloat(m[2]);
    const total = homeScore + awayScore;
    if (total === line) return "PUSH";
    const overHit = total > line;
    return m[1].toLowerCase() === "over" ? (overHit ? "WIN" : "LOSS") : overHit ? "LOSS" : "WIN";
  }

  // MONEYLINE ("Team ML") and SPREAD ("Team +/-X") both start with a team name.
  const side = pick.selection.startsWith(homeTeam)
    ? "home"
    : pick.selection.startsWith(awayTeam)
      ? "away"
      : null;
  if (!side) return null;
  const own = side === "home" ? homeScore : awayScore;
  const opp = side === "home" ? awayScore : homeScore;

  if (pick.betType === "MONEYLINE") {
    if (own === opp) return "PUSH";
    return own > opp ? "WIN" : "LOSS";
  }

  if (pick.betType === "SPREAD") {
    const m = pick.selection.match(/([+-]\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const margin = own + parseFloat(m[1]) - opp;
    if (margin === 0) return "PUSH";
    return margin > 0 ? "WIN" : "LOSS";
  }

  return null;
}

// --- Period / half market grading -------------------------------------------

// Which periods (0-indexed) each market key covers. Undefined = not a period
// market. Halves are derived from quarters for the 4-quarter sports.
const PERIOD_SPANS: Record<string, number[]> = {
  h2h_q1: [0], spreads_q1: [0], totals_q1: [0],
  h2h_p1: [0], spreads_p1: [0], totals_p1: [0],
  h2h_h1: [0, 1], spreads_h1: [0, 1], totals_h1: [0, 1],
  h2h_1st_5_innings: [0, 1, 2, 3, 4],
  spreads_1st_5_innings: [0, 1, 2, 3, 4],
  totals_1st_5_innings: [0, 1, 2, 3, 4],
};

/** True when this market is graded from period scores rather than the final. */
export function isPeriodMarket(marketKey: string | null | undefined): boolean {
  return Boolean(marketKey && marketKey in PERIOD_SPANS);
}

function sumPeriods(line: number[], span: number[]): number | null {
  // Every period in the span must exist, or we can't grade it confidently.
  if (span.some((i) => i >= line.length)) return null;
  return span.reduce((total, i) => total + line[i], 0);
}

/**
 * Grade a period/half pick from ESPN's per-period linescores. Uses the pick's
 * structured fields (marketKey / side / linePoint) rather than parsing the
 * display string. Returns null whenever the result isn't certain — a pick we
 * can't grade confidently is left for manual settlement.
 */
export function gradePeriodPick(
  pick: { marketKey: string | null; side: string | null; linePoint: number | null },
  scores: { home: number[]; away: number[] },
  homeTeam: string,
  awayTeam: string
): PickResult | null {
  const { marketKey, side, linePoint } = pick;
  const span = marketKey ? PERIOD_SPANS[marketKey] : undefined;
  if (!marketKey || !span || !side) return null;

  const home = sumPeriods(scores.home, span);
  const away = sumPeriods(scores.away, span);
  if (home === null || away === null) return null;

  // Totals: side is Over/Under, linePoint is the number.
  if (marketKey.startsWith("totals")) {
    if (linePoint == null) return null;
    const total = home + away;
    if (total === linePoint) return "PUSH";
    const over = total > linePoint;
    if (/^over$/i.test(side)) return over ? "WIN" : "LOSS";
    if (/^under$/i.test(side)) return over ? "LOSS" : "WIN";
    return null;
  }

  // Moneyline / spread: side is a team name.
  const isHome = teamMatches(side, homeTeam);
  const isAway = teamMatches(side, awayTeam);
  if (isHome === isAway) return null; // ambiguous or unmatched
  const own = isHome ? home : away;
  const opp = isHome ? away : home;

  if (marketKey.startsWith("h2h")) {
    if (own === opp) return "PUSH";
    return own > opp ? "WIN" : "LOSS";
  }
  if (marketKey.startsWith("spreads")) {
    if (linePoint == null) return null;
    const margin = own + linePoint - opp;
    if (margin === 0) return "PUSH";
    return margin > 0 ? "WIN" : "LOSS";
  }
  return null;
}

function teamMatches(side: string, team: string): boolean {
  const a = side.toLowerCase().replace(/[^a-z0-9]/g, "");
  const b = team.toLowerCase().replace(/[^a-z0-9]/g, "");
  return a === b || a.includes(b) || b.includes(a);
}

// --- Player prop grading ----------------------------------------------------

// Our market key -> the canonical stat(s) to sum from ESPN's box score.
// Combination props (Pts+Reb+Ast) list every component. Markets that need
// play-by-play ordering rather than a box-score total (first/last scorer) are
// deliberately absent, so they stay manual.
const PROP_STATS: Record<string, string[]> = {
  // Basketball
  player_points: ["points"],
  player_rebounds: ["rebounds"],
  player_assists: ["assists"],
  player_threes: ["threes"],
  player_blocks: ["blocks"],
  player_steals: ["steals"],
  player_points_rebounds: ["points", "rebounds"],
  player_points_assists: ["points", "assists"],
  player_rebounds_assists: ["rebounds", "assists"],
  player_points_rebounds_assists: ["points", "rebounds", "assists"],
  // Football
  player_pass_yds: ["passYards"],
  player_pass_tds: ["passTds"],
  player_pass_completions: ["passCompletions"],
  player_pass_interceptions: ["interceptions"],
  player_rush_yds: ["rushYards"],
  player_rush_attempts: ["rushAttempts"],
  player_receptions: ["receptions"],
  player_reception_yds: ["recYards"],
  player_anytime_td: ["rushTds", "recTds"],
  // Hockey
  player_goals: ["goals"],
  player_shots_on_goal: ["shots"],
  player_total_saves: ["saves"],
  player_goal_scorer_anytime: ["goals"],
  // Baseball
  batter_hits: ["hits"],
  batter_home_runs: ["homeRuns"],
  batter_rbis: ["rbis"],
  batter_runs_scored: ["runs"],
  pitcher_strikeouts: ["strikeouts"],
  pitcher_walks: ["walks"],
  pitcher_earned_runs: ["earnedRuns"],
};

/** True when this market can be graded from a box score. */
export function isGradableProp(marketKey: string | null | undefined): boolean {
  return Boolean(marketKey && marketKey in PROP_STATS);
}

/**
 * Grade a player prop from ESPN box-score stats. Uses the structured fields
 * captured at submission (playerName / marketKey / linePoint / side) rather
 * than parsing the display string.
 *
 * Returns null — leaving the pick for manual settlement — whenever the answer
 * isn't certain: unknown market, player not found in the box score, or a stat
 * the box score didn't report. A player who appears with no relevant stat is
 * NOT treated as a zero, because "didn't play" and "played and recorded none"
 * are indistinguishable here and only one of them should settle an Over as a
 * loss.
 */
export function gradePropPick(
  pick: { marketKey: string | null; playerName: string | null; linePoint: number | null; side: string | null },
  stats: Map<string, StatLine>
): PickResult | null {
  const { marketKey, playerName, linePoint, side } = pick;
  if (!marketKey || !playerName || !side) return null;

  const components = PROP_STATS[marketKey];
  if (!components) return null;

  const line = stats.get(fighterKey(playerName));
  if (!line) return null; // player not in the box score — grade by hand

  // Every component must be present; a missing one means we can't total it.
  let total = 0;
  for (const stat of components) {
    const value = line[stat];
    if (value === undefined) {
      // Anytime-scorer markets sum optional components (a WR has no rushing
      // TDs), so treat missing as 0 only when at least one component exists.
      if (components.some((c) => line[c] !== undefined)) continue;
      return null;
    }
    total += value;
  }

  // Yes/No markets (anytime TD, anytime goal) have no line — they hit on 1+.
  if (linePoint == null) {
    if (/^(yes|over)$/i.test(side)) return total >= 1 ? "WIN" : "LOSS";
    if (/^no$/i.test(side)) return total >= 1 ? "LOSS" : "WIN";
    return null;
  }

  if (total === linePoint) return "PUSH";
  const over = total > linePoint;
  if (/^over$/i.test(side)) return over ? "WIN" : "LOSS";
  if (/^under$/i.test(side)) return over ? "LOSS" : "WIN";
  return null;
}

export interface AutoSettleReport {
  candidates: number;
  settled: number;
  skipped: number;
  errors: string[];
  /** Contest picks graded in the same sweep (they share the score lookups). */
  contest?: { candidates: number; settled: number; skipped: number };
}

/**
 * Grade every pending schedule-created pick whose game has finished, using
 * final scores from The Odds API. Manual picks (no event id) and selections
 * that can't be parsed are left untouched.
 */
export async function runAutoSettle(): Promise<AutoSettleReport> {
  const apiKey = oddsApiKey();
  const report: AutoSettleReport = { candidates: 0, settled: 0, skipped: 0, errors: [] };

  if (!apiKey) {
    report.errors.push("THE_ODDS_API_KEY not configured");
    return report;
  }

  const cutoff = new Date(Date.now() - DAYS_FROM * 24 * 60 * 60 * 1000);
  const started = { lt: new Date(), gt: cutoff };
  const [picks, contestPicks] = await Promise.all([
    prisma.pick.findMany({
      where: {
        result: "PENDING",
        oddsApiEventId: { not: null },
        oddsApiSportKey: { not: null },
        eventStartsAt: started,
      },
    }),
    // Contest picks are always board-sourced, so every pending one is gradable.
    prisma.contestPick.findMany({
      where: {
        result: "PENDING",
        oddsApiEventId: { not: null },
        oddsApiSportKey: { not: null },
        eventStartsAt: started,
      },
    }),
  ]);
  report.candidates = picks.length;
  report.contest = { candidates: contestPicks.length, settled: 0, skipped: 0 };
  if (picks.length === 0 && contestPicks.length === 0) return report;

  // One scores request per distinct league (2 credits each with daysFrom), and
  // both pick types share the results — grading contest picks adds no extra
  // upstream calls when the leagues overlap.
  const sportKeys = [
    ...new Set([
      ...picks.map((p) => p.oddsApiSportKey!),
      ...contestPicks.map((p) => p.oddsApiSportKey!),
    ]),
  ];
  const finals = new Map<string, FinalScore>();

  for (const sportKey of sportKeys) {
    try {
      const res = await fetch(
        `${API_BASE}/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=${DAYS_FROM}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        report.errors.push(`scores fetch failed for ${sportKey}: ${res.status}`);
        continue;
      }
      const data = (await res.json()) as ScoreEntry[];
      for (const entry of data) {
        if (!entry.completed || !entry.scores) continue;
        const home = entry.scores.find((s) => s.name === entry.home_team);
        const away = entry.scores.find((s) => s.name === entry.away_team);
        if (!home || !away) continue;
        finals.set(entry.id, {
          homeTeam: entry.home_team,
          awayTeam: entry.away_team,
          homeScore: Number(home.score),
          awayScore: Number(away.score),
        });
      }
    } catch (error) {
      report.errors.push(`scores fetch failed for ${sportKey}: ${String(error)}`);
    }
  }

  // Period/half picks need ESPN's per-period linescores (the odds feed only
  // returns a final total). Fetch once per sport, and only if such a pick is
  // actually waiting — it's a free endpoint but there's no reason to call it
  // otherwise.
  // Both handicapper and contest picks carry the structured line when they were
  // taken off the board, so both can use period/box-score grading.
  const needsEspn = [...picks, ...contestPicks].filter(
    (p) => isPeriodMarket(p.marketKey) || isGradableProp(p.marketKey)
  );
  const periodScores = new Map<PickSport, Map<string, PeriodScores>>();
  for (const sport of new Set(needsEspn.map((p) => p.sport))) {
    periodScores.set(sport, await getFinalPeriodScores(sport));
  }

  // Box scores are one request per game, so fetch them only for games that
  // actually have a gradable prop waiting, and only once each.
  const boxScores = new Map<string, Map<string, StatLine>>();
  for (const pick of needsEspn) {
    if (!isGradableProp(pick.marketKey)) continue;
    const final = finals.get(pick.oddsApiEventId!);
    if (!final) continue;
    const espnEventId = periodScores
      .get(pick.sport)
      ?.get(livePairKey(final.awayTeam, final.homeTeam))?.eventId;
    if (!espnEventId || boxScores.has(espnEventId)) continue;
    boxScores.set(espnEventId, await getPlayerStats(pick.sport, espnEventId));
  }


  /**
   * Grade one pick (either kind) against everything we fetched: the feed's final
   * score, ESPN's period linescores, and ESPN's box score. Returns null to leave
   * it pending for manual settlement.
   */
  function resolveResult(pick: {
    betType: string;
    selection: string;
    marketKey: string | null;
    side: string | null;
    linePoint: number | null;
    playerName: string | null;
    sport: PickSport;
    oddsApiEventId: string | null;
  }): PickResult | null {
    const score = finals.get(pick.oddsApiEventId!);
    if (!score) return null; // game not finished, or no score available yet

    const espnGame = periodScores.get(pick.sport)?.get(livePairKey(score.awayTeam, score.homeTeam));

    if (isPeriodMarket(pick.marketKey)) {
      return espnGame ? gradePeriodPick(pick, espnGame, score.homeTeam, score.awayTeam) : null;
    }
    if (isGradableProp(pick.marketKey)) {
      const stats = espnGame?.eventId ? boxScores.get(espnGame.eventId) : undefined;
      return stats ? gradePropPick(pick, stats) : null;
    }
    // Full-game team markets grade off the final score. Props we have no stat
    // mapping for (first/last scorer) stay manual.
    return pick.playerName ? null : gradePick(pick, score);
  }

  for (const pick of picks) {
    const result = resolveResult(pick);
    if (!result) {
      report.skipped += 1;
      continue;
    }
    await prisma.pick.update({
      where: { id: pick.id },
      data: { result, settledAt: new Date(), settledBy: "auto" },
    });
    report.settled += 1;
  }

  for (const pick of contestPicks) {
    const result = resolveResult(pick);
    if (!result) {
      report.contest!.skipped += 1;
      continue;
    }
    await prisma.contestPick.update({
      where: { id: pick.id },
      data: { result, settledAt: new Date(), settledBy: "auto" },
    });
    report.contest!.settled += 1;
  }

  return report;
}
