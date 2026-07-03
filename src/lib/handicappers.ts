import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";
import type { HandicapperProfile, Pick as PickModel } from "@prisma/client";

export type HandicapperSummary = HandicapperProfile & {
  stats: HandicapperStats;
  last30Stats: HandicapperStats;
};

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
  };
}
