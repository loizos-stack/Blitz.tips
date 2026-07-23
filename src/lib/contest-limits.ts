// Per-entrant contest quotas. Kept in a plain (non "server-only") module so both
// the pick API (enforcement) and the client rules modal (display) can import the
// numbers from one source of truth.
export const MAX_UNITS_PER_DAY = 5;
export const MAX_PICKS_PER_DAY = 5;
export const MAX_PICKS_PER_WEEK = 25;

const DAY_MS = 24 * 60 * 60 * 1000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Midnight UTC at the start of `now`'s day. */
export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Midnight UTC at the start of `now`'s week (weeks start Monday). */
export function startOfUtcWeek(now = new Date()): Date {
  const day = now.getUTCDay(); // 0 = Sun … 6 = Sat
  const sinceMonday = (day + 6) % 7;
  const d = startOfUtcDay(now);
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d;
}

export interface QuotaUsage {
  picksToday: number;
  unitsToday: number;
  picksThisWeek: number;
  dayResetsAt: Date;
  weekResetsAt: Date;
}

/** Tally an entry's quota usage from its picks (counted by submission time). */
export function computeQuotaUsage(picks: { createdAt: Date; units: number }[], now = new Date()): QuotaUsage {
  const dayStart = startOfUtcDay(now).getTime();
  const weekStart = startOfUtcWeek(now).getTime();
  let picksToday = 0;
  let unitsToday = 0;
  let picksThisWeek = 0;
  for (const p of picks) {
    const t = p.createdAt.getTime();
    if (t >= weekStart) picksThisWeek += 1;
    if (t >= dayStart) {
      picksToday += 1;
      unitsToday += p.units;
    }
  }
  return {
    picksToday,
    unitsToday: round2(unitsToday),
    picksThisWeek,
    dayResetsAt: new Date(startOfUtcDay(now).getTime() + DAY_MS),
    weekResetsAt: new Date(startOfUtcWeek(now).getTime() + 7 * DAY_MS),
  };
}
