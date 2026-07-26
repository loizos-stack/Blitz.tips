// Time-window filters for the contest standings and entrant pages. Kept in a
// plain (non "server-only") module so the server pages and the client filter
// components share one definition. Windows are evaluated against a pick's
// eventStartsAt (the game date), on UTC calendar boundaries to match the quota
// resets in contest-limits.
import { startOfUtcDay, startOfUtcWeek } from "@/lib/contest-limits";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ContestWindowKey = "overall" | "today" | "yesterday" | "week" | "month";

export const CONTEST_WINDOWS: { key: ContestWindowKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export interface WindowRange {
  // null = unbounded on that side (used by "overall").
  start: Date | null;
  end: Date | null;
}

/** Midnight UTC at the first day of `now`'s month. */
export function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** The [start, end) date range a window covers, relative to `now`. */
export function contestWindowRange(key: ContestWindowKey, now = new Date()): WindowRange {
  switch (key) {
    case "today": {
      const start = startOfUtcDay(now);
      return { start, end: new Date(start.getTime() + DAY_MS) };
    }
    case "yesterday": {
      const todayStart = startOfUtcDay(now);
      return { start: new Date(todayStart.getTime() - DAY_MS), end: todayStart };
    }
    case "week": {
      const start = startOfUtcWeek(now);
      return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
    }
    case "month": {
      const start = startOfUtcMonth(now);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      return { start, end };
    }
    case "overall":
    default:
      return { start: null, end: null };
  }
}

/** Is `date` inside the half-open [start, end) window range? */
export function isWithinWindow(date: Date, range: WindowRange): boolean {
  if (range.start && date < range.start) return false;
  if (range.end && date >= range.end) return false;
  return true;
}

/** Keep only the picks whose eventStartsAt falls inside the window. */
export function filterPicksByWindow<T extends { eventStartsAt: Date | string }>(
  picks: T[],
  key: ContestWindowKey,
  now = new Date()
): T[] {
  if (key === "overall") return picks;
  const range = contestWindowRange(key, now);
  return picks.filter((p) => isWithinWindow(new Date(p.eventStartsAt), range));
}
