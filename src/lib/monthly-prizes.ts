import "server-only";
import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";

/**
 * The monthly handicapper prize.
 *
 * Every calendar month the three handicappers with the best settled record win
 * cash. It is the first thing on the site that pays handicappers for being
 * right rather than for being subscribed to, so the rules below are written to
 * be defensible to someone who just lost by a tenth of a unit.
 *
 * Three decisions worth stating, because each one is a way this could have
 * been gamed:
 *
 *  1. **Net units, not ROI.** ROI rewards a small, lucky sample: three picks at
 *     +200 is an unbeatable ROI and tells you nothing. Units reward being right
 *     repeatedly, which is the thing worth paying for.
 *
 *  2. **A floor on settled picks.** Without one, a single +500 longshot wins
 *     $500. MIN_SETTLED_PICKS is what makes the ranking a record rather than a
 *     coin flip — and it is why the standings show ineligible cappers greyed
 *     out rather than hiding them, so nobody thinks the board is broken.
 *
 *  3. **Settlement date, not post date.** A pick counts for the month it was
 *     *graded* in. Posting on the 31st for a game on the 1st would otherwise
 *     let a capper bank a result in a month it was not earned, and would put
 *     the same pick in two months' standings depending on which date you read.
 */

/** First month the prize runs. Earlier months are not prize months. */
export const PRIZES_START_MONTH = "2026-11";

/** 1st, 2nd, 3rd, in cents. Length defines how many places pay. */
export const PRIZE_CENTS = [50_000, 20_000, 10_000] as const;

/** Total guaranteed each month, for the promo copy. */
export const PRIZE_POOL_CENTS = PRIZE_CENTS.reduce((a, b) => a + b, 0);

/**
 * Settled picks needed in the month to be ranked.
 *
 * Ten is a deliberate middle: low enough that a part-time capper posting two or
 * three a week clears it, high enough that variance on a single pick cannot buy
 * first place.
 */
export const MIN_SETTLED_PICKS = 10;

/** "2026-11" for any date inside November 2026, in UTC. */
export function prizeMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/** The month before the given one — the one being paid out while a new one runs. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/** Half-open [start, end) covering the month in UTC. */
export function monthWindow(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Not a month: ${month}`);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

/** "November 2026", for headings. */
export function monthLabel(month: string): string {
  const { start } = monthWindow(month);
  return start.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Is this month inside the prize era at all? */
export function isPrizeMonth(month: string): boolean {
  return month >= PRIZES_START_MONTH;
}

/**
 * Where the prize is right now.
 *
 * "upcoming" exists because the promotion starts before the competition does:
 * the money is announced today and the first month runs from
 * PRIZES_START_MONTH. Without this the whole thing would be invisible until
 * the morning it begins, which is the one week it most needs to be seen — a
 * capper cannot qualify in a month they did not know about.
 */
export type PrizePhase = "upcoming" | "live";

export function prizePhase(now: Date = new Date()): PrizePhase {
  return isPrizeMonth(prizeMonth(now)) ? "live" : "upcoming";
}

/** The month the board is about: the current one once live, else the first one. */
export function boardMonth(now: Date = new Date()): string {
  return prizePhase(now) === "live" ? prizeMonth(now) : PRIZES_START_MONTH;
}

/** "Sunday 1 November" — the day the first month opens, for the countdown copy. */
export function startsOnLabel(): string {
  return monthWindow(PRIZES_START_MONTH).start.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** Cents won at a 1-based rank, or 0 for places outside the ladder. */
export function prizeForRank(rank: number): number {
  return PRIZE_CENTS[rank - 1] ?? 0;
}

export interface MonthlyStanding {
  handicapperId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  stats: HandicapperStats;
  /** Settled picks in the month — the number the floor is applied to. */
  settled: number;
  /** Met MIN_SETTLED_PICKS. Ineligible cappers are listed but never ranked. */
  eligible: boolean;
  /** 1-based, among eligible cappers only. Null when ineligible. */
  rank: number | null;
  /** Cents this position would win if the month ended now. */
  prizeCents: number;
}

/**
 * The standings for a month, best net units first.
 *
 * Live while the month is running — this is the race, not the result. The
 * frozen result lives in MonthlyPrizeAward once an admin records it, so a
 * later correction to a pick cannot silently rewrite who won.
 */
export async function monthlyStandings(month: string): Promise<MonthlyStanding[]> {
  const { start, end } = monthWindow(month);

  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      picks: {
        // Graded inside the month. PENDING picks have no settledAt and so do
        // not count — an ungraded pick is not a result.
        where: { settledAt: { gte: start, lt: end }, result: { not: "PENDING" } },
        select: {
          odds: true,
          units: true,
          result: true,
          eventStartsAt: true,
          settledAt: true,
        },
      },
    },
  });

  const rows = handicappers
    .map((h) => {
      const stats = computeStats(h.picks);
      const settled = stats.wins + stats.losses + stats.pushes;
      return {
        handicapperId: h.id,
        handle: h.handle,
        displayName: h.displayName,
        avatarUrl: h.avatarUrl,
        stats,
        settled,
        eligible: settled >= MIN_SETTLED_PICKS,
        rank: null as number | null,
        prizeCents: 0,
      };
    })
    // Anyone with nothing settled this month is not in the race at all; listing
    // every dormant profile under the prize board would bury the contenders.
    .filter((r) => r.settled > 0);

  rows.sort((a, b) => {
    // Eligible first, then units, then the tie-breaks below.
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (b.stats.unitsNet !== a.stats.unitsNet) return b.stats.unitsNet - a.stats.unitsNet;
    // A tie on units goes to the bigger sample: more picks at the same profit
    // is the harder thing to do, and it breaks ties deterministically rather
    // than by whatever order the database returned.
    if (b.settled !== a.settled) return b.settled - a.settled;
    return a.handle.localeCompare(b.handle);
  });

  let rank = 0;
  for (const row of rows) {
    if (!row.eligible) continue;
    rank += 1;
    row.rank = rank;
    row.prizeCents = prizeForRank(rank);
  }

  return rows;
}

export interface RecordedAward {
  rank: number;
  handle: string;
  displayName: string;
  prizeCents: number;
  unitsNet: number;
  record: string;
  paidAt: Date | null;
}

/** The frozen result for a month, if an admin has recorded it. */
export async function recordedAwards(month: string): Promise<RecordedAward[]> {
  const rows = await prisma.monthlyPrizeAward.findMany({
    where: { month },
    orderBy: { rank: "asc" },
    include: { handicapper: { select: { handle: true, displayName: true } } },
  });
  return rows.map((r) => ({
    rank: r.rank,
    handle: r.handicapper.handle,
    displayName: r.handicapper.displayName,
    prizeCents: r.prizeCents,
    unitsNet: r.unitsNet,
    record: r.record,
    paidAt: r.paidAt,
  }));
}

/**
 * Freeze a finished month's top three.
 *
 * Refuses a month that has not ended: recording a winner mid-month would be
 * announcing a result that can still change, and the whole point of this site
 * is that a published record cannot.
 */
export async function recordMonth(month: string): Promise<{ recorded: number; error?: string }> {
  if (!isPrizeMonth(month)) return { recorded: 0, error: `${monthLabel(month)} is before the prize started.` };
  const { end } = monthWindow(month);
  if (Date.now() < end.getTime()) {
    return { recorded: 0, error: `${monthLabel(month)} has not finished yet.` };
  }

  const standings = await monthlyStandings(month);
  const winners = standings.filter((s) => s.rank !== null && s.prizeCents > 0);

  for (const w of winners) {
    await prisma.monthlyPrizeAward.upsert({
      where: { month_rank: { month, rank: w.rank! } },
      create: {
        month,
        rank: w.rank!,
        handicapperId: w.handicapperId,
        prizeCents: w.prizeCents,
        unitsNet: w.stats.unitsNet,
        record: w.stats.record,
      },
      // A re-record corrects the figures but never clears a payment already made.
      update: {
        handicapperId: w.handicapperId,
        prizeCents: w.prizeCents,
        unitsNet: w.stats.unitsNet,
        record: w.stats.record,
      },
    });
  }

  return { recorded: winners.length };
}
