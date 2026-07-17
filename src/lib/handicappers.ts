import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";
import { computeStreaks, lastNStats } from "@/lib/analytics";
import { isFeaturedHandicapper } from "@/lib/plans";
import type { HandicapperProfile, Pick as PickModel, Review, ParlayLeg } from "@prisma/client";

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

export async function listHandicapperSummaries(): Promise<HandicapperSummary[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: { picks: true },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.map(toSummary);
}

/** Summaries for a specific set of handicapper ids (e.g. the ones a user follows). */
export async function listHandicapperSummariesByIds(ids: string[]): Promise<HandicapperSummary[]> {
  if (ids.length === 0) return [];
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { id: { in: ids }, suspendedAt: null },
    include: { picks: true },
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
    include: { picks: true },
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

function toSummary(handicapper: HandicapperProfile & { picks: PickModel[] }): HandicapperSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STATS_LOOKBACK_DAYS);

  const recentPicks = handicapper.picks.filter((p) => p.createdAt >= cutoff);

  return {
    ...handicapper,
    stats: computeStats(handicapper.picks),
    last30Stats: computeStats(recentPicks),
    last10Stats: lastNStats(handicapper.picks, 10),
    currentStreak: computeStreaks(handicapper.picks).current,
    isFeatured: isFeaturedHandicapper(handicapper.plan, handicapper.planStatus),
  };
}
