import "server-only";
import { prisma } from "@/lib/prisma";
import { oddsApiKey } from "@/lib/odds-api";
import { getFinalPeriodScores, livePairKey, type PeriodScores } from "@/lib/espn-scores";
import type { Pick as PickModel, PickResult, PickSport } from "@prisma/client";

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
  pick: Pick<PickModel, "betType" | "selection">,
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

  for (const pick of picks) {
    const score = finals.get(pick.oddsApiEventId!);
    if (!score) {
      report.skipped += 1; // game not finished (or score unavailable) yet
      continue;
    }
    const result = gradePick(pick, score);
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

  // Period/half picks need ESPN's per-period linescores (the odds feed only
  // returns a final total). Fetch once per sport, and only if such a pick is
  // actually waiting — it's a free endpoint but there's no reason to call it
  // otherwise.
  const periodSports = [
    ...new Set(contestPicks.filter((p) => isPeriodMarket(p.marketKey)).map((p) => p.sport)),
  ];
  const periodScores = new Map<PickSport, Map<string, PeriodScores>>();
  for (const sport of periodSports) {
    periodScores.set(sport, await getFinalPeriodScores(sport));
  }

  for (const pick of contestPicks) {
    const score = finals.get(pick.oddsApiEventId!);
    let result: PickResult | null = null;

    if (isPeriodMarket(pick.marketKey) && score) {
      const byPair = periodScores.get(pick.sport);
      const line = byPair?.get(livePairKey(score.awayTeam, score.homeTeam));
      if (line) result = gradePeriodPick(pick, line, score.homeTeam, score.awayTeam);
    } else if (score) {
      // Full-game markets grade off the final score as before. Player props and
      // anything else structured stay pending for manual settlement.
      result = pick.playerName ? null : gradePick(pick, score);
    }

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
