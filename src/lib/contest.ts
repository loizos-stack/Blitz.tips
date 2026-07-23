import "server-only";
import type { Contest, ContestEntry, ContestPick } from "@prisma/client";
import { computeStats } from "@/lib/odds";
import { icmEquityCents, ICM_MAX_FIELD } from "@/lib/icm";

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
  const rows = entries.map((entry) => {
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
