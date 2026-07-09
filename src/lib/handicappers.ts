import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";
import { isFeaturedHandicapper } from "@/lib/plans";
import type { HandicapperProfile, Pick as PickModel, Testimonial, ParlayLeg } from "@prisma/client";

export type PickWithLegs = PickModel & { parlayLegs: ParlayLeg[] };

export type HandicapperSummary = HandicapperProfile & {
  stats: HandicapperStats;
  last30Stats: HandicapperStats;
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

export async function getHandicapperByHandle(
  handle: string
): Promise<(HandicapperSummary & { picksList: PickWithLegs[]; testimonials: Testimonial[] }) | null> {
  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { handle },
    include: {
      picks: {
        orderBy: { eventStartsAt: "desc" },
        include: { parlayLegs: { orderBy: { order: "asc" } } },
      },
      testimonials: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!handicapper) return null;

  return {
    ...toSummary(handicapper),
    picksList: handicapper.picks,
    testimonials: handicapper.testimonials,
  };
}

function toSummary(handicapper: HandicapperProfile & { picks: PickModel[] }): HandicapperSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STATS_LOOKBACK_DAYS);

  const recentPicks = handicapper.picks.filter((p) => p.createdAt >= cutoff);

  return {
    ...handicapper,
    stats: computeStats(handicapper.picks),
    last30Stats: computeStats(recentPicks),
    isFeatured: isFeaturedHandicapper(handicapper.plan, handicapper.planStatus),
  };
}
