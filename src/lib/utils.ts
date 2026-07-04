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

export const BET_TYPE_LABELS: Record<string, string> = {
  SPREAD: "Spread",
  MONEYLINE: "Moneyline",
  TOTAL: "Total",
  PROP: "Prop",
  PARLAY: "Parlay",
  FUTURES: "Futures",
};
