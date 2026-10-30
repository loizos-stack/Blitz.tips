import "server-only";
import { monthWindow, previousMonth, prizeMonth } from "@/lib/monthly-prizes";

/**
 * The time windows the leaderboard can be ranked over.
 *
 * All-time is still the default: it is the claim the site is built on — a
 * complete, unedited record — and a leaderboard that opened on "last 7 days"
 * would rank whoever got hot this week. The windows are for the question
 * all-time cannot answer: who is good *now*.
 *
 * A pick belongs to the window it was **settled** in, not posted in. Same rule
 * as the monthly prize, and for the same reason: a pending pick is not a
 * result, and grading is the moment a record changes.
 *
 * The month helpers come from monthly-prizes rather than being written again
 * here. Two pieces of the site disagreeing about when a month starts is a
 * genuinely confusing bug, and the prize already had to answer it precisely.
 */

export type PeriodKey = "all" | "7d" | "30d" | "month" | "lastmonth";

export const PERIODS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "all", label: "All time", short: "All time" },
  { key: "7d", label: "Last 7 days", short: "7d" },
  { key: "30d", label: "Last 30 days", short: "30d" },
  { key: "month", label: "This month", short: "This month" },
  { key: "lastmonth", label: "Last month", short: "Last month" },
];

const PERIOD_KEYS = new Set<string>(PERIODS.map((p) => p.key));

export function isPeriodKey(v: string | undefined): v is PeriodKey {
  return v !== undefined && PERIOD_KEYS.has(v);
}

export function periodLabel(key: PeriodKey): string {
  return PERIODS.find((p) => p.key === key)?.label ?? "All time";
}

export interface Window {
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The half-open [start, end) a period covers, or null for all time.
 *
 * The rolling windows end at `now` rather than at the end of today, so "last 7
 * days" cannot include results that have not happened. The calendar windows
 * end at the month boundary, so "this month" keeps the same shape as the prize
 * standings sitting directly above it on the page — the two must agree, or the
 * board and the table below it will show different leaders for November.
 */
export function periodWindow(key: PeriodKey, now: Date = new Date()): Window | null {
  switch (key) {
    case "all":
      return null;
    case "7d":
      return { start: new Date(now.getTime() - 7 * DAY_MS), end: now };
    case "30d":
      return { start: new Date(now.getTime() - 30 * DAY_MS), end: now };
    case "month":
      return monthWindow(prizeMonth(now));
    case "lastmonth":
      return monthWindow(previousMonth(prizeMonth(now)));
  }
}
