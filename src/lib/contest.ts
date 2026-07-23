import "server-only";
import type { Contest, ContestEntry, ContestPick } from "@prisma/client";
import { computeStats } from "@/lib/odds";

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

// A sensible default $50k / top-20 payout curve (cents), used to prefill the
// admin form. Sums to 5,000,000 cents.
export const DEFAULT_SUPERCAPPER_SPLIT_CENTS: number[] = [
  1550000, 800000, 500000, 400000, 300000, 250000, 200000, 175000, 150000, 125000,
  100000, 90000, 80000, 70000, 60000, 50000, 40000, 30000, 20000, 10000,
];

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

  const ranked: ContestStanding[] = qualified.map((r, i) => ({
    ...r,
    rank: i + 1,
    prizeCents: contest.prizeSplitCents[i] ?? 0,
  }));

  const rest: ContestStanding[] = unqualified.map((r) => ({ ...r, rank: null, prizeCents: 0 }));

  return [...ranked, ...rest];
}
