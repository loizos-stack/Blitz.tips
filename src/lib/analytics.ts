import type { Pick as PickModel, PickResult } from "@prisma/client";
import { computeStats, unitProfit, type HandicapperStats } from "@/lib/odds";

/** The minimum a pick needs for a settled-record calculation. */
export type StatPick = Pick<PickModel, "odds" | "units" | "result">;

/** A stat pick plus the timestamp used to order it on a timeline. */
export type TimedPick = StatPick & { settledAt?: Date | null; eventStartsAt: Date };

/** The moment a pick belongs to on the results timeline. */
export function pickDate(p: { settledAt?: Date | null; eventStartsAt: Date }): Date {
  return p.settledAt ?? p.eventStartsAt;
}

export function isDecided(result: PickResult): boolean {
  return result === "WIN" || result === "LOSS";
}

export function isSettled(result: PickResult): boolean {
  return result === "WIN" || result === "LOSS" || result === "PUSH";
}

export interface LabeledBreakdown {
  key: string;
  label: string;
  stats: HandicapperStats;
}

/** Split picks into groups by a key, compute a record for each, busiest first. */
export function breakdownBy<T extends StatPick>(
  picks: T[],
  keyOf: (p: T) => string,
  labelOf: (key: string) => string
): LabeledBreakdown[] {
  const groups = new Map<string, T[]>();
  for (const p of picks) {
    const k = keyOf(p);
    const arr = groups.get(k);
    if (arr) arr.push(p);
    else groups.set(k, [p]);
  }
  return [...groups.entries()]
    .map(([key, ps]) => ({ key, label: labelOf(key), stats: computeStats(ps) }))
    .sort((a, b) => b.stats.totalPicks - a.stats.totalPicks);
}

export interface StreakInfo {
  /** Signed trailing streak: positive = wins in a row, negative = losses in a row. */
  current: number;
  bestWin: number;
  worstLoss: number;
}

/** Longest/current win & loss runs from decided picks, oldest-to-newest. */
export function computeStreaks(picks: TimedPick[]): StreakInfo {
  const decided = picks
    .filter((p) => isDecided(p.result))
    .sort((a, b) => pickDate(a).getTime() - pickDate(b).getTime());

  let run = 0;
  let bestWin = 0;
  let worstLoss = 0;
  for (const p of decided) {
    if (p.result === "WIN") run = run > 0 ? run + 1 : 1;
    else run = run < 0 ? run - 1 : -1;
    bestWin = Math.max(bestWin, run);
    worstLoss = Math.min(worstLoss, run);
  }

  return { current: currentStreakFrom(decided), bestWin, worstLoss: Math.abs(worstLoss) };
}

/**
 * The trailing run, from decided picks ALREADY in chronological order.
 *
 * Split out of computeStreaks so a caller that has sorted its picks once can
 * reuse that order instead of paying for a second filter-and-sort. The whole
 * reason it takes pre-sorted input is to make that saving possible, so the
 * order is the caller's promise to keep — hand it an unsorted array and it
 * will cheerfully report a streak that never happened.
 *
 * computeStreaks still calls it, so there is one definition of what a current
 * streak is rather than two that can drift apart.
 */
export function currentStreakFrom(decidedChronological: readonly { result: PickResult }[]): number {
  let current = 0;
  for (let i = decidedChronological.length - 1; i >= 0; i--) {
    const isWin = decidedChronological[i].result === "WIN";
    if (current === 0) current = isWin ? 1 : -1;
    else if (current > 0 && isWin) current += 1;
    else if (current < 0 && !isWin) current -= 1;
    else break;
  }
  return current;
}

/** Running units P/L after each settled pick, oldest-to-newest — for a sparkline. */
export function cumulativeUnits(picks: TimedPick[]): number[] {
  const settled = picks
    .filter((p) => isSettled(p.result))
    .sort((a, b) => pickDate(a).getTime() - pickDate(b).getTime());
  let total = 0;
  return settled.map((p) => {
    total += unitProfit(p.odds, p.units, p.result);
    return Math.round(total * 100) / 100;
  });
}

/** Stats for only the picks whose timeline date falls within the last N days. */
export function statsSince(picks: TimedPick[], days: number, now = Date.now()): HandicapperStats {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return computeStats(picks.filter((p) => pickDate(p).getTime() >= cutoff));
}

/** Stats over only the most recent N settled picks (by timeline) — e.g. an L10 form line. */
export function lastNStats(picks: TimedPick[], n: number): HandicapperStats {
  const recent = picks
    .filter((p) => isSettled(p.result))
    .sort((a, b) => pickDate(a).getTime() - pickDate(b).getTime())
    .slice(-n);
  return computeStats(recent);
}

export function formatUnits(n: number): string {
  const s = n > 0 ? `+${n}` : `${n}`;
  return `${s}u`;
}

export function formatStreak(current: number): string {
  if (current === 0) return "—";
  return current > 0 ? `W${current}` : `L${Math.abs(current)}`;
}
