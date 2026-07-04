import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";
import { isFeaturedHandicapper } from "@/lib/plans";
import type { HandicapperProfile, Pick as PickModel } from "@prisma/client";

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

const STATS_LOOKBACK_DAYS = 30;

export async function listHandicapperSummaries(): Promise<HandicapperSummary[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    include: { picks: true },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.map(toSummary);
}

export async function getHandicapperByHandle(
  handle: string
): Promise<(HandicapperSummary & { picksList: PickModel[] }) | null> {
  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { handle },
    include: { picks: { orderBy: { eventStartsAt: "desc" } } },
  });

  if (!handicapper) return null;

  return { ...toSummary(handicapper), picksList: handicapper.picks };
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
