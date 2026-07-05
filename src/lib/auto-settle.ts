import "server-only";
import { prisma } from "@/lib/prisma";
import type { Pick as PickModel, PickResult } from "@prisma/client";

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

export interface AutoSettleReport {
  candidates: number;
  settled: number;
  skipped: number;
  errors: string[];
}

/**
 * Grade every pending schedule-created pick whose game has finished, using
 * final scores from The Odds API. Manual picks (no event id) and selections
 * that can't be parsed are left untouched.
 */
export async function runAutoSettle(): Promise<AutoSettleReport> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  const report: AutoSettleReport = { candidates: 0, settled: 0, skipped: 0, errors: [] };

  if (!apiKey) {
    report.errors.push("THE_ODDS_API_KEY not configured");
    return report;
  }

  const cutoff = new Date(Date.now() - DAYS_FROM * 24 * 60 * 60 * 1000);
  const picks = await prisma.pick.findMany({
    where: {
      result: "PENDING",
      oddsApiEventId: { not: null },
      oddsApiSportKey: { not: null },
      eventStartsAt: { lt: new Date(), gt: cutoff },
    },
  });
  report.candidates = picks.length;
  if (picks.length === 0) return report;

  // One scores request per distinct league (2 credits each with daysFrom).
  const sportKeys = [...new Set(picks.map((p) => p.oddsApiSportKey!))];
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

  return report;
}
