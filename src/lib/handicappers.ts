import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";
import { computeStreaks, lastNStats } from "@/lib/analytics";
import { isFeaturedHandicapper } from "@/lib/plans";
import { SPORT_LABELS } from "@/lib/utils";
import type { HandicapperProfile, Pick as PickModel, Review, ParlayLeg, PickSport } from "@prisma/client";

export type PickWithLegs = PickModel & { parlayLegs: ParlayLeg[] };

export type ReviewWithAuthor = Review & {
  author: { id: string; name: string | null; username: string | null; image: string | null };
};

export type HandicapperSummary = HandicapperProfile & {
  stats: HandicapperStats;
  last30Stats: HandicapperStats;
  /** Record over the most recent 10 settled picks (the "L10" form line). */
  last10Stats: HandicapperStats;
  /** Current win/loss run (positive = wins, negative = losses); shown on cards. */
  currentStreak: number;
  isFeatured: boolean;
  /** Number of approved reviews. */
  reviewsCount: number;
  /** Mean approved rating (1 decimal), or null when there are none. */
  reviewsAverage: number | null;
};

/** Gold handicappers are pinned to the top, per their plan's promised placement; ties broken by the given stat. */
export function sortFeaturedFirst<T extends { isFeatured: boolean }>(
  items: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return compareFn(a, b);
  });
}

/**
 * Paid-plan handicappers (Gold above Silver, active billing only) are pinned
 * above free ones regardless of the chosen sort; ties within each tier break
 * by the given stat comparator. Used on the directory, where placement is
 * part of what paid plans buy.
 */
export function sortPaidFirst<T extends Pick<HandicapperProfile, "plan" | "planStatus">>(
  items: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  const tier = (h: T) =>
    h.planStatus !== "ACTIVE" ? 0 : h.plan === "GOLD" ? 2 : h.plan === "SILVER" ? 1 : 0;
  return [...items].sort((a, b) => tier(b) - tier(a) || compareFn(a, b));
}

const STATS_LOOKBACK_DAYS = 30;

const APPROVED_REVIEW_RATINGS = {
  reviews: { where: { status: "APPROVED" as const }, select: { rating: true } },
} as const;

export async function listHandicapperSummaries(): Promise<HandicapperSummary[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: { picks: true, ...APPROVED_REVIEW_RATINGS },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.map(toSummary);
}

export type DirectoryHandicapper = HandicapperSummary & {
  followersCount: number;
  /** Has posted at least one player-prop pick. */
  hasProps: boolean;
  /** Has posted at least one parlay. */
  hasParlays: boolean;
  /** Lowercased haystack of everything on the profile the finder search matches. */
  searchText: string;
};

/**
 * All active handicappers with their follower count, approved-review count, and
 * the flags/haystack the homepage "Find a Handicapper" finder needs to filter
 * (sport, player props, parlays), sort (hot, most followed, most reviewed), and
 * search across everything on the profile.
 */
export async function listHandicapperDirectory(): Promise<DirectoryHandicapper[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: {
      // No parlayLegs join — a parlay's parent `selection` already concatenates
      // its legs, so the search haystack keeps them without the extra query.
      picks: true,
      ...APPROVED_REVIEW_RATINGS,
      _count: { select: { followers: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.map((h) => {
    const searchText = [
      h.displayName,
      h.handle,
      h.bio ?? "",
      ...h.sports.map((s) => SPORT_LABELS[s] ?? s),
      ...h.picks.flatMap((p) => [p.matchup, p.selection, p.league ?? "", p.analysis ?? ""]),
    ]
      .join(" ")
      .toLowerCase();

    return {
      ...toSummary(h),
      followersCount: h._count.followers,
      hasProps: h.picks.some((p) => p.betType === "PROP"),
      hasParlays: h.picks.some((p) => p.betType === "PARLAY"),
      searchText,
    };
  });
}

// The non-sport quick filters for the homepage finder. Sport keys (NBA, MLB, …)
// are the other valid filter values.
export const FINDER_SORTS = ["all", "hot", "followed", "reviewed"] as const;
export type FinderSort = (typeof FINDER_SORTS)[number];

/**
 * Filter + sort the directory for the homepage finder. `filter` is one of the
 * FINDER_SORTS keys or a PickSport value; `query` matches display name / handle.
 * Featured (gold) cappers stay pinned first only under the default "all" sort —
 * the explicit sorts (hot / most followed / most reviewed) are respected as-is.
 */
export function applyHandicapperFinder(
  list: DirectoryHandicapper[],
  filter: string,
  query: string
): DirectoryHandicapper[] {
  let out = [...list];

  if (filter in SPORT_LABELS) {
    out = out.filter((h) => h.sports.includes(filter as PickSport));
    out.sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "props") {
    out = out.filter((h) => h.hasProps).sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "parlays") {
    out = out.filter((h) => h.hasParlays).sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "gold") {
    // Only GOLD-plan (featured) handicappers, best net units first.
    out = out.filter((h) => h.isFeatured).sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "hot") {
    out.sort(
      (a, b) => b.currentStreak - a.currentStreak || b.last10Stats.unitsNet - a.last10Stats.unitsNet
    );
  } else if (filter === "followed") {
    out.sort((a, b) => b.followersCount - a.followersCount || b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "reviewed") {
    out.sort((a, b) => b.reviewsCount - a.reviewsCount || b.stats.unitsNet - a.stats.unitsNet);
  } else {
    out = sortFeaturedFirst(out, (a, b) => b.stats.unitsNet - a.stats.unitsNet);
  }

  // Search matches everything on the profile (name, @handle, bio, sports, and
  // every pick's matchup / selection / league / analysis / parlay legs).
  const q = query.trim().toLowerCase();
  if (q) out = out.filter((h) => h.searchText.includes(q));
  return out;
}

/** Summaries for a specific set of handicapper ids (e.g. the ones a user follows). */
export async function listHandicapperSummariesByIds(ids: string[]): Promise<HandicapperSummary[]> {
  if (ids.length === 0) return [];
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { id: { in: ids }, suspendedAt: null },
    include: { picks: true, ...APPROVED_REVIEW_RATINGS },
  });
  return handicappers.map(toSummary);
}

export async function getHandicapperByHandle(
  handle: string
): Promise<(HandicapperSummary & { picksList: PickWithLegs[]; reviews: ReviewWithAuthor[] }) | null> {
  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { handle },
    include: {
      picks: {
        orderBy: { eventStartsAt: "desc" },
        include: { parlayLegs: { orderBy: { order: "asc" } } },
      },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, username: true, image: true } } },
      },
    },
  });

  if (!handicapper) return null;

  return {
    ...toSummary(handicapper),
    picksList: handicapper.picks,
    reviews: handicapper.reviews,
  };
}

export type HotHandicapper = HandicapperSummary & {
  /** Stats over picks settled within the lookback window (default last 7 days). */
  weekStats: HandicapperStats;
};

/**
 * The "hottest" handicappers over a recent window, ranked by ROI. Only counts
 * picks settled within the window, and requires a minimum sample so a single
 * lucky settled pick doesn't top the list. Used by the signup discover step.
 */
export async function listHottestHandicappers({
  days = 7,
  limit = 6,
  minSettled = 3,
}: { days?: number; limit?: number; minSettled?: number } = {}): Promise<HotHandicapper[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: { picks: true, ...APPROVED_REVIEW_RATINGS },
  });

  const ranked = handicappers
    .map((h) => {
      const windowPicks = h.picks.filter((p) => p.settledAt && p.settledAt >= cutoff);
      return { ...toSummary(h), weekStats: computeStats(windowPicks) };
    })
    .filter((h) => h.weekStats.roi !== null && h.weekStats.wins + h.weekStats.losses >= minSettled)
    .sort((a, b) => (b.weekStats.roi ?? 0) - (a.weekStats.roi ?? 0));

  return ranked.slice(0, limit);
}

function toSummary(
  handicapper: HandicapperProfile & { picks: PickModel[]; reviews?: { rating: number }[] }
): HandicapperSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STATS_LOOKBACK_DAYS);

  const recentPicks = handicapper.picks.filter((p) => p.createdAt >= cutoff);

  const ratings = handicapper.reviews ?? [];
  const reviewsCount = ratings.length;
  const reviewsAverage =
    reviewsCount === 0
      ? null
      : Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / reviewsCount) * 10) / 10;

  return {
    ...handicapper,
    stats: computeStats(handicapper.picks),
    last30Stats: computeStats(recentPicks),
    last10Stats: lastNStats(handicapper.picks, 10),
    currentStreak: computeStreaks(handicapper.picks).current,
    isFeatured: isFeaturedHandicapper(handicapper.plan, handicapper.planStatus),
    reviewsCount,
    reviewsAverage,
  };
}
