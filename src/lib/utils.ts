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

export const BET_TYPE_LABELS: Record<string, string> = {
  SPREAD: "Spread",
  MONEYLINE: "Moneyline",
  TOTAL: "Total",
  PROP: "Prop",
  PARLAY: "Parlay",
  FUTURES: "Futures",
};
