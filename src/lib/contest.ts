import "server-only";
import type { Contest, ContestEntry, ContestPick } from "@prisma/client";
import { computeStats } from "@/lib/odds";
import { icmEquityCents, ICM_MAX_FIELD } from "@/lib/icm";
import { startOfUtcDay } from "@/lib/contest-limits";

// The lifecycle phase shown to visitors, derived from the contest's dates and
// status (so a DRAFT/CLOSED admin state overrides the calendar).
export type ContestPhase = "upcoming" | "live" | "ended" | "settled";

export function contestPhase(contest: Pick<Contest, "status" | "startsAt" | "endsAt">, now = new Date()): ContestPhase {
  if (contest.status === "SETTLED") return "settled";
  if (contest.status === "DRAFT") return "upcoming";
  if (now < contest.startsAt) return "upcoming";
  if (now > contest.endsAt) return "ended";
  return "live";
}

/** True while entrants may still submit picks (contest OPEN and inside the window). */
export function isContestAcceptingPicks(
  contest: Pick<Contest, "status" | "startsAt" | "endsAt">,
  now = new Date()
): boolean {
  return contest.status === "OPEN" && now >= contest.startsAt && now <= contest.endsAt;
}

// A sensible default $25k / top-20 payout curve (cents), used to prefill the
// admin form. Sums to 2,500,000 cents.
export const DEFAULT_SUPERCAPPER_SPLIT_CENTS: number[] = [
  775000, 400000, 250000, 200000, 150000, 125000, 100000, 87500, 75000, 62500,
  50000, 45000, 40000, 35000, 30000, 25000, 20000, 15000, 10000, 5000,
];

// Dynamic payout structure: paid places scale with how many people have joined.
// Start at 3 places and add one for every 10 entrants — so the 30th joiner adds
// a 4th place, the 40th a 5th, and so on.
export const MIN_PAYOUT_SPOTS = 3;
export const ENTRANTS_PER_EXTRA_SPOT = 10;

export function payoutSpotsForEntrants(entrantCount: number): number {
  return Math.max(MIN_PAYOUT_SPOTS, Math.floor(entrantCount / ENTRANTS_PER_EXTRA_SPOT) + 1);
}

// How many more entrants are needed before the next paid place opens up. The
// next place opens when the entrant count reaches currentSpots × 10 (place #4
// at 30, #5 at 40, …), so it's that threshold minus the current count.
export function entrantsUntilNextSpot(entrantCount: number): number {
  return payoutSpotsForEntrants(entrantCount) * ENTRANTS_PER_EXTRA_SPOT - entrantCount;
}

/**
 * A top-heavy base prize ladder of `spots` places that sums to exactly
 * `poolCents`. Weights decay geometrically (each place ~72% of the one above),
 * then are scaled to the pool with the rounding remainder folded into 1st. This
 * is the ladder ICM then smooths, so the guaranteed pool is always fully paid
 * out across however many places are currently open.
 */
export function contestPrizeLadderCents(poolCents: number, spots: number): number[] {
  const n = Math.max(1, spots);
  const decay = 0.72;
  const weights = Array.from({ length: n }, (_, i) => decay ** i);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const ladder = weights.map((w) => Math.round((w / totalWeight) * poolCents));
  // Reconcile rounding so the ladder sums to the pool to the cent.
  const drift = poolCents - ladder.reduce((a, b) => a + b, 0);
  ladder[0] += drift;
  return ladder;
}

/**
 * The prize ladder actually in effect for a contest right now. For a
 * dynamic-payout contest it's derived from the pool and the live entrant count;
 * otherwise it's the stored split. Length = number of paid places.
 */
export function effectivePrizeLadderCents(
  contest: Pick<Contest, "dynamicPayouts" | "prizePoolCents" | "prizeSplitCents">,
  activeEntrantCount: number
): number[] {
  if (contest.dynamicPayouts) {
    return contestPrizeLadderCents(contest.prizePoolCents, payoutSpotsForEntrants(activeEntrantCount));
  }
  return contest.prizeSplitCents;
}

/** Count entrants that count toward payout scaling (excludes disqualified). */
export function activeEntrantCount(entries: { disqualifiedAt: Date | null }[]): number {
  return entries.reduce((n, e) => (e.disqualifiedAt ? n : n + 1), 0);
}

// The ICM payout ladder is a pure function of how many places are paid and the
// prize split, so cache it (the DP is cheap but not free, and it's re-derived
// on every standings render).
const icmCache = new Map<string, number[]>();

/**
 * Auto-calculated payouts per ICM. The full guaranteed pool (the prize split)
 * is distributed across the top `paidCount` finishers using the Independent
 * Chip Model, with each finisher's "stack" set by their finishing rank (1st
 * biggest) — so payouts follow rank but are smoothed the way an ICM deal
 * smooths a rigid ladder. Returns cents indexed by rank (index 0 = 1st).
 */
export function contestIcmPayoutsCents(paidCount: number, prizeSplitCents: number[]): number[] {
  const n = Math.min(paidCount, prizeSplitCents.length);
  if (n <= 0) return [];
  const prizes = prizeSplitCents.slice(0, n);
  // Beyond the exact-DP cap, fall back to the raw ladder rather than blow up.
  if (n > ICM_MAX_FIELD) return prizes;

  const key = `${n}:${prizeSplitCents.join(",")}`;
  const cached = icmCache.get(key);
  if (cached) return cached;

  // Rank stacks follow the prize ladder's own shape (1st biggest), so ICM keeps
  // the payouts top-heavy while smoothing the ladder the way an ICM deal does —
  // trimming the top places and lifting the lower ones. Falls back to a linear
  // ramp if a ladder somehow has a non-positive amount (ICM needs positive
  // stacks).
  const stacks = prizes.map((c, i) => (c > 0 ? c : n - i));
  const payouts = icmEquityCents(stacks, prizes);
  icmCache.set(key, payouts);
  return payouts;
}

export interface ContestStanding {
  entryId: string;
  userId: string;
  name: string;
  // Rank among qualified entries (1-based); null if not yet qualified.
  rank: number | null;
  qualified: boolean;
  roi: number | null;
  unitsNet: number;
  record: string;
  settledPicks: number;
  totalPicks: number;
  // Projected prize at the current standing (cents), 0 if out of the money.
  prizeCents: number;
}

type EntryWithPicks = ContestEntry & { picks: ContestPick[]; user: { name: string | null; username: string | null } };

/**
 * Rank contest entries by ROI over their settled picks. Only entries that have
 * met the minimum-pick floor are ranked and money-eligible; the rest are listed
 * as "not yet qualified" so entrants can see how many more graded picks they
 * need. Ties break on net units, then settled-pick count (more picks = more
 * proven), then name for stability.
 */
export function computeStandings(
  entries: EntryWithPicks[],
  contest: Pick<Contest, "minPicks" | "prizeSplitCents">
): ContestStanding[] {
  // Disqualified entries (fraud) are removed from the board and the payouts.
  const rows = entries
    .filter((entry) => !entry.disqualifiedAt)
    .map((entry) => {
    const stats = computeStats(entry.picks);
    const settledPicks = stats.wins + stats.losses + stats.pushes;
    const name = entry.user.username ?? entry.user.name ?? "Entrant";
    return {
      entryId: entry.id,
      userId: entry.userId,
      name,
      qualified: settledPicks >= contest.minPicks,
      roi: stats.roi,
      unitsNet: stats.unitsNet,
      record: stats.record,
      settledPicks,
      totalPicks: stats.totalPicks,
    };
  });

  const qualified = rows
    .filter((r) => r.qualified)
    .sort(
      (a, b) =>
        (b.roi ?? -Infinity) - (a.roi ?? -Infinity) ||
        b.unitsNet - a.unitsNet ||
        b.settledPicks - a.settledPicks ||
        a.name.localeCompare(b.name)
    );

  const unqualified = rows
    .filter((r) => !r.qualified)
    .sort((a, b) => b.settledPicks - a.settledPicks || a.name.localeCompare(b.name));

  // Payouts are ICM-calculated: the pool is chopped across however many
  // finishers qualified (capped at the number of paid places) by their rank.
  const paidCount = Math.min(qualified.length, contest.prizeSplitCents.length);
  const icmPayouts = contestIcmPayoutsCents(paidCount, contest.prizeSplitCents);

  const ranked: ContestStanding[] = qualified.map((r, i) => ({
    ...r,
    rank: i + 1,
    prizeCents: icmPayouts[i] ?? 0,
  }));

  const rest: ContestStanding[] = unqualified.map((r) => ({ ...r, rank: null, prizeCents: 0 }));

  return [...ranked, ...rest];
}

/**
 * The overall standings as they stood at an earlier moment — every entry's picks
 * are truncated to those whose game had started before `cutoffMs`, then ranked
 * the same way. Used to show each contestant's rank movement (vs. yesterday).
 */
export function computeStandingsAsOf(
  entries: EntryWithPicks[],
  contest: Pick<Contest, "minPicks" | "prizeSplitCents">,
  cutoffMs: number
): ContestStanding[] {
  const asOf = entries.map((e) => ({
    ...e,
    picks: e.picks.filter((p) => p.eventStartsAt.getTime() < cutoffMs),
  }));
  return computeStandings(asOf, contest);
}

export interface RankPoint {
  // ISO timestamp of the cutoff this rank was measured at.
  t: string;
  // The entrant's ROI rank (1 = best) among entrants with a graded pick by then.
  rank: number;
  // How many entrants were ranked at that point (the field size).
  of: number;
  roi: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reconstruct an entrant's ROI rank over the life of the contest, sampled at
 * daily cutoffs (adaptively coarsened so a long contest stays under ~90 points).
 * At each cutoff every non-disqualified entrant is ranked by ROI over the picks
 * whose game had started by then — there's no min-pick floor here, so the line
 * is populated from the entrant's first graded pick. A point is emitted only for
 * cutoffs at which the target entrant is actually ranked.
 */
export function entrantRankHistory(
  entries: EntryWithPicks[],
  targetEntryId: string,
  startsAt: Date,
  endsAt: Date,
  now = new Date()
): RankPoint[] {
  const active = entries.filter((e) => !e.disqualifiedAt);
  const end = now < endsAt ? now : endsAt;
  const firstCutoff = startOfUtcDay(startsAt).getTime() + DAY_MS;
  const endMs = end.getTime();
  if (endMs < firstCutoff) {
    // Contest just started — fall back to a single "now" sample.
    return rankAt(active, targetEntryId, endMs);
  }

  const totalDays = Math.ceil((endMs - firstCutoff) / DAY_MS) + 1;
  const stepDays = Math.max(1, Math.ceil(totalDays / 90));
  const step = stepDays * DAY_MS;

  const cutoffs: number[] = [];
  for (let c = firstCutoff; c < endMs; c += step) cutoffs.push(c);
  cutoffs.push(endMs); // always finish at "now"

  const points: RankPoint[] = [];
  for (const cutoff of cutoffs) points.push(...rankAt(active, targetEntryId, cutoff));
  return points;
}

// Rank the field by ROI over picks started before `cutoff`; return the target's
// point (or nothing if it isn't ranked yet).
function rankAt(active: EntryWithPicks[], targetEntryId: string, cutoff: number): RankPoint[] {
  const ranked = active
    .map((e) => {
      const picks = e.picks.filter((p) => p.eventStartsAt.getTime() < cutoff);
      const stats = computeStats(picks);
      const settled = stats.wins + stats.losses + stats.pushes;
      return { entryId: e.id, roi: stats.roi, unitsNet: stats.unitsNet, settled };
    })
    .filter((r) => r.settled > 0)
    .sort(
      (a, b) =>
        (b.roi ?? -Infinity) - (a.roi ?? -Infinity) || b.unitsNet - a.unitsNet || b.settled - a.settled
    );

  const idx = ranked.findIndex((r) => r.entryId === targetEntryId);
  if (idx < 0) return [];
  return [{ t: new Date(cutoff).toISOString(), rank: idx + 1, of: ranked.length, roi: ranked[idx].roi }];
}
