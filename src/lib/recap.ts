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
  /**
   * The storage key for this recap: the day (or span) covered, plus the
   * handicappers it was narrowed to.
   *
   * It is one string rather than a set of columns because it is also the Blob
   * filename and the unique key of RecapVideo, and a recap of one
   * handicapper's Tuesday must not overwrite the video of everyone's Tuesday.
   * Handles can only be lowercase letters, numbers and underscores, so "+"
   * cannot appear inside one and is safe as the separator.
   */
  date: string;
  /** "Tuesday 28 October", for the video's header. */
  label: string;
  rows: RecapRow[];
  /** Settled picks not shown as rows. */
  omitted: number;
  /** "winners" is the promo reel; absent means the honest daily recap. */
  mode?: "winners";
  /** The handicappers this was narrowed to; empty means the whole site. */
  handles: string[];
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

/** The shape a handicapper handle is allowed to take. */
const HANDLE = /^[a-z0-9_]+$/;

/**
 * Clean up a requested set of handles.
 *
 * Sorted and de-duplicated because the result goes into the storage key:
 * picking the same two handicappers in the other order has to land on the same
 * video rather than rendering a second copy of it.
 */
export function normalizeHandles(handles: readonly string[] | undefined | null): string[] {
  if (!handles?.length) return [];
  return [...new Set(handles.map((h) => h.trim().toLowerCase()).filter((h) => HANDLE.test(h)))].sort();
}

/** Parse the `handicappers=a,b` query parameter. */
export function parseHandles(value: string | null): string[] {
  return normalizeHandles(value?.split(",") ?? []);
}

/** The storage key: the period, then the handles it was narrowed to. */
function keyFor(period: string, handles: string[]): string {
  return handles.length ? `${period}+${handles.join("+")}` : period;
}

/** Split a storage key back into its period and its handles, for display. */
export function splitRecapKey(key: string): { period: string; handles: string[] } {
  const [period, ...handles] = key.split("+");
  return { period, handles };
}

/** Only these handicappers, or everyone when the list is empty. */
function handleFilter(handles: string[]) {
  return handles.length ? { handicapper: { handle: { in: handles } } } : {};
}

/** " — @alice & @bob" for the header, so a filtered video says it is filtered. */
function handleSuffix(handles: string[]): string {
  if (!handles.length) return "";
  if (handles.length === 1) return ` — @${handles[0]}`;
  if (handles.length === 2) return ` — @${handles[0]} & @${handles[1]}`;
  return ` — ${handles.length} handicappers`;
}

/**
 * The winners across a span of days, for a promo reel.
 *
 * Deliberately built on the same totals as the recap. A winners-only video is
 * ordinary marketing, but on a site whose pitch is *verified* records it
 * cannot be the whole story on screen — so `totals` still covers EVERY settled
 * pick in the span, wins and losses alike, and the renderer prints it. The
 * reel shows the best of a period; the figure beneath it says what the period
 * actually did.
 */
export async function winnersFor(
  from: string,
  to: string,
  requested: readonly string[] = []
): Promise<RecapPayload> {
  const { start } = dayBounds(from);
  const { end } = dayBounds(to);
  if (end <= start) throw new Error(`${to} is not on or after ${from}`);
  const handles = normalizeHandles(requested);

  const picks = await prisma.pick.findMany({
    where: {
      settledAt: { gte: start, lt: end },
      result: { in: ["WIN", "LOSS", "PUSH"] },
      ...handleFilter(handles),
    },
    select: {
      odds: true, units: true, result: true, sport: true,
      matchup: true, selection: true,
      handicapper: { select: { handle: true } },
    },
    orderBy: { settledAt: "asc" },
  });

  const stats = computeStats(picks);
  const units = picks.reduce((sum, p) => sum + unitProfit(p.odds, p.units, p.result), 0);
  const toRow = (p: (typeof picks)[number]): RecapRow => ({
    handle: p.handicapper.handle,
    sport: SPORT_LABELS[p.sport] ?? String(p.sport),
    matchup: p.matchup,
    selection: p.selection,
    odds: formatOdds(p.odds),
    units: p.units,
    result: p.result as RecapOutcome,
    profit: unitProfit(p.odds, p.units, p.result),
  });

  // Biggest wins first — this one IS a highlight reel, and says so.
  const wins = picks
    .filter((p) => p.result === "WIN")
    .map(toRow)
    .sort((a, b) => b.profit - a.profit);
  const rows = wins.slice(0, RECAP_ROW_LIMIT);
  const decided = stats.wins + stats.losses;

  const label =
    from === to
      ? dayBounds(from).start.toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
        })
      : `${dayBounds(from).start.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })} – ${dayBounds(to).start.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`;

  return {
    date: keyFor(from === to ? from : `${from}_${to}`, handles),
    label: label + handleSuffix(handles),
    rows,
    // How many WINNERS are not shown — the reel's own omission.
    omitted: Math.max(wins.length - rows.length, 0),
    mode: "winners",
    handles,
    totals: {
      settled: picks.length,
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

export async function recapFor(
  date: string,
  requested: readonly string[] = []
): Promise<RecapPayload> {
  const { start, end } = dayBounds(date);
  const handles = normalizeHandles(requested);

  // Settled, not posted: a pick made last week and graded today belongs to
  // today's results. VOID and PENDING are excluded — a voided pick is not a
  // result, and including it would pad the row count with nothing.
  const picks = await prisma.pick.findMany({
    where: {
      settledAt: { gte: start, lt: end },
      result: { in: ["WIN", "LOSS", "PUSH"] },
      ...handleFilter(handles),
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
    date: keyFor(date, handles),
    label:
      start.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }) + handleSuffix(handles),
    rows,
    omitted: Math.max(all.length - rows.length, 0),
    handles,
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
