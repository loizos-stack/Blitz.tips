import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export const SPORT_LABELS: Record<string, string> = {
  NFL: "NFL",
  NBA: "NBA",
  WNBA: "WNBA",
  MLB: "MLB",
  NHL: "NHL",
  NCAAF: "NCAAF",
  NCAAB: "NCAAB",
  SOCCER: "Soccer",
  GOLF: "Golf",
  TENNIS: "Tennis",
  UFC_MMA: "UFC / MMA",
  OTHER: "Other",
};

// US team leagues are written "Away @ Home"; everything else (soccer, tennis,
// golf, MMA, other/international) is written "Home vs Away" with the home side
// first. Kept here (not in the server-only odds lib) so client forms can share
// the exact same formatting.
const AT_SEPARATOR_SPORTS = new Set(["NFL", "NBA", "WNBA", "MLB", "NHL", "NCAAF", "NCAAB"]);

export function usesVsSeparator(sport: string): boolean {
  return !AT_SEPARATOR_SPORTS.has(sport);
}

/** Build a matchup label from the two sides, per the sport's convention. */
export function formatMatchup(sport: string, awayTeam: string, homeTeam: string): string {
  return usesVsSeparator(sport) ? `${homeTeam} vs ${awayTeam}` : `${awayTeam} @ ${homeTeam}`;
}

/**
 * Split a matchup label back into its two sides — the inverse of formatMatchup.
 * "Home vs Away" resolves home-first; "Away @ Home" (or "at") resolves
 * away-first. Returns null for labels without a recognizable separator (e.g. a
 * parlay's "3-leg parlay" placeholder).
 */
export function parseMatchupSides(matchup: string): { awayTeam: string; homeTeam: string } | null {
  const vs = matchup.split(/\s+vs\.?\s+/i);
  if (vs.length === 2) return { homeTeam: vs[0].trim(), awayTeam: vs[1].trim() };
  const at = matchup.split(/\s+(?:@|at)\s+/i);
  if (at.length === 2) return { awayTeam: at[0].trim(), homeTeam: at[1].trim() };
  return null;
}

export const BET_TYPE_LABELS: Record<string, string> = {
  SPREAD: "Spread",
  MONEYLINE: "Moneyline",
  TOTAL: "Total",
  PROP: "Prop",
  PARLAY: "Parlay",
  FUTURES: "Futures",
};
