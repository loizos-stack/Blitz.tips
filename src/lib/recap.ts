import "server-only";
import { prisma } from "@/lib/prisma";
import { computeStats, formatOdds, unitProfit } from "@/lib/odds";
import { SPORT_LABELS } from "@/lib/utils";

/**
 * The day's settled picks, shaped for the results-recap video.
 *
 * The honesty problem this has to solve: a video can show maybe six rows
 * legibly, and a busy day settles far more than six. Showing the six best ones
 * would be a highlight reel of a day that might have lost money — exactly the
 * thing a site selling *verified* records cannot publish.
 *
 * So the totals are computed from every settled pick of the day and the rows
 * are only an illustration beneath them. `omitted` says how many are not
 * shown, and the renderer is required to display it. Order the rows however
 * you like; the headline is already the whole truth.
 */

/** How many picks fit on screen and stay readable at phone size. */
export const RECAP_ROW_LIMIT = 6;

export type RecapOutcome = "WIN" | "LOSS" | "PUSH";

export interface RecapRow {
  handle: string;
  sport: string;
  matchup: string;
  selection: string;
  odds: string;
  units: number;
  result: RecapOutcome;
  /** Units won or lost, signed. */
  profit: number;
}

export interface RecapPayload {
  /** The day covered, as YYYY-MM-DD in UTC. */
  date: string;
  /** "Tuesday 28 October", for the video's header. */
  label: string;
  rows: RecapRow[];
  /** Settled picks not shown as rows. */
  omitted: number;
  totals: {
    settled: number;
    wins: number;
    losses: number;
    pushes: number;
    /** "12-6-1", pushes dropped when there are none. */
    record: string;
    units: number;
    /** Whole-number percent, or null when nothing was decided. */
    hitRate: number | null;
    handicappers: number;
  };
}

/** Midnight-to-midnight UTC around a YYYY-MM-DD. */
function dayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new Error(`Not a date: ${date}`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** YYYY-MM-DD for the UTC day before the given moment. */
export function yesterday(now: Date = new Date()): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

export async function recapFor(date: string): Promise<RecapPayload> {
  const { start, end } = dayBounds(date);

  // Settled, not posted: a pick made last week and graded today belongs to
  // today's results. VOID and PENDING are excluded — a voided pick is not a
  // result, and including it would pad the row count with nothing.
  const picks = await prisma.pick.findMany({
    where: {
      settledAt: { gte: start, lt: end },
      result: { in: ["WIN", "LOSS", "PUSH"] },
    },
    select: {
      odds: true,
      units: true,
      result: true,
      sport: true,
      matchup: true,
      selection: true,
      handicapper: { select: { handle: true } },
    },
    orderBy: { settledAt: "asc" },
  });

  const stats = computeStats(picks);
  const units = picks.reduce((sum, p) => sum + unitProfit(p.odds, p.units, p.result), 0);

  const all: RecapRow[] = picks.map((p) => ({
    handle: p.handicapper.handle,
    sport: SPORT_LABELS[p.sport] ?? String(p.sport),
    matchup: p.matchup,
    selection: p.selection,
    odds: formatOdds(p.odds),
    units: p.units,
    result: p.result as RecapOutcome,
    profit: unitProfit(p.odds, p.units, p.result),
  }));

  // Biggest movers first — wins and losses alike, by absolute size. A day that
  // went badly leads with its worst beat, which is the point: the figure above
  // it already says so, and a recap that only ever opens on a winner stops
  // being worth believing.
  const rows = [...all]
    .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
    .slice(0, RECAP_ROW_LIMIT);

  const decided = stats.wins + stats.losses;

  return {
    date,
    label: start.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }),
    rows,
    omitted: Math.max(all.length - rows.length, 0),
    totals: {
      settled: all.length,
      wins: stats.wins,
      losses: stats.losses,
      pushes: stats.pushes,
      record:
        stats.pushes > 0
          ? `${stats.wins}-${stats.losses}-${stats.pushes}`
          : `${stats.wins}-${stats.losses}`,
      units: Math.round(units * 100) / 100,
      hitRate: decided > 0 ? Math.round((stats.wins / decided) * 100) : null,
      handicappers: new Set(picks.map((p) => p.handicapper.handle)).size,
    },
  };
}
