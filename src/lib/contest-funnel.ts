import "server-only";
import { prisma } from "@/lib/prisma";
import { listHandicapperSummaries, sortPaidFirst, type HandicapperSummary } from "@/lib/handicappers";
import { isPickLocked } from "@/lib/pick-visibility";
import type { CapperRow } from "@/components/contest/capper-list";

/**
 * Shared queries behind the contest -> marketplace touchpoints. Contest entrants
 * have to post 100 picks to be eligible, so they come back to the site over and
 * over; these are the reads that turn those visits into the two things that
 * actually earn — a subscription, or a new handicapper.
 *
 * Everything here leans on the cached `listHandicapperSummaries()`, so none of
 * it adds a per-request table scan.
 */

/** Minimum graded picks before a handicapper is worth putting in front of anyone. */
const MIN_PICKS_TO_RECOMMEND = 20;

/**
 * Handicappers currently posting a better ROI than `roi`, best offer first.
 * A null `roi` (entrant has nothing graded yet) means "just show me the best".
 * Paid tiers sort first — placement is part of what a paid plan buys — with ROI
 * breaking ties inside each tier.
 */
export async function cappersBeating(roi: number | null, limit = 3): Promise<CapperRow[]> {
  const all = await listHandicapperSummaries();
  return sortPaidFirst(
    all.filter(
      (h) =>
        h.stats.roi != null &&
        h.stats.totalPicks >= MIN_PICKS_TO_RECOMMEND &&
        (roi == null || h.stats.roi > roi)
    ),
    (a, b) => (b.stats.roi ?? 0) - (a.stats.roi ?? 0)
  )
    .slice(0, limit)
    .map(toCapperRow);
}

export function toCapperRow(h: HandicapperSummary): CapperRow {
  return {
    handle: h.handle,
    displayName: h.displayName,
    record: h.stats.record,
    unitsNet: h.stats.unitsNet,
    roi: h.stats.roi,
    monthlyPriceCents: h.monthlyPriceCents,
  };
}

/** A handicapper with a live play on the same game an entrant just bet. */
export interface CapperOnEvent {
  handle: string;
  displayName: string;
  monthlyPriceCents: number | null;
  roi: number | null;
  record: string;
  /** Their play — null while it's still behind the paywall for this viewer. */
  selection: string | null;
  odds: number | null;
  locked: boolean;
}

const MAX_CAPPERS_ON_EVENT = 4;

/**
 * Handicappers with a pending pick on `oddsApiEventId`. Shown right after an
 * entrant submits their own pick on that game — the highest-relevance moment we
 * get, because they've just told us exactly which game they care about.
 *
 * Premium plays stay hidden unless the viewer subscribes (the normal paywall
 * rules apply, via `isPickLocked`), which is the point: a locked play on the
 * game you just bet is the pitch. The viewer's own picks are excluded.
 */
export async function cappersOnEvent(
  oddsApiEventId: string,
  viewerId: string | null
): Promise<CapperOnEvent[]> {
  const [picks, summaries, subs] = await Promise.all([
    prisma.pick.findMany({
      where: { oddsApiEventId, result: "PENDING", handicapper: { suspendedAt: null } },
      select: {
        isPremium: true,
        result: true,
        eventStartsAt: true,
        selection: true,
        odds: true,
        handicapper: { select: { id: true, userId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    listHandicapperSummaries(),
    viewerId
      ? prisma.subscription.findMany({
          where: { subscriberId: viewerId, status: "ACTIVE" },
          select: { handicapperId: true },
        })
      : Promise.resolve([]),
  ]);

  const subscribedTo = new Set(subs.map((s) => s.handicapperId));
  const byId = new Map(summaries.map((s) => [s.id, s]));

  // One row per handicapper — their most recent play on the game wins.
  const seen = new Set<string>();
  const rows: (HandicapperSummary & { row: CapperOnEvent })[] = [];

  for (const pick of picks) {
    const { id, userId } = pick.handicapper;
    if (userId === viewerId || seen.has(id)) continue;
    // Absent from the cached summaries means suspended or brand new — skip
    // rather than surface a handicapper we have no verified stats for.
    const summary = byId.get(id);
    if (!summary) continue;
    seen.add(id);

    const locked = isPickLocked(pick, subscribedTo.has(id));
    rows.push({
      ...summary,
      row: {
        handle: summary.handle,
        displayName: summary.displayName,
        monthlyPriceCents: summary.monthlyPriceCents,
        roi: summary.stats.roi,
        record: summary.stats.record,
        selection: locked ? null : pick.selection,
        odds: locked ? null : pick.odds,
        locked,
      },
    });
  }

  return sortPaidFirst(rows, (a, b) => (b.stats.roi ?? 0) - (a.stats.roi ?? 0))
    .slice(0, MAX_CAPPERS_ON_EVENT)
    .map((r) => r.row);
}
