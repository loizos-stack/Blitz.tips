import { guardAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeStandings, DEFAULT_SUPERCAPPER_SPLIT_CENTS } from "@/lib/contest";
import { ContestManager } from "@/components/admin/contest-manager";

export const dynamic = "force-dynamic";

export default async function AdminContestsPage() {
  await guardAdminPage("contests");

  const contests = await prisma.contest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      entries: { include: { picks: true, user: { select: { name: true, username: true } } } },
    },
  });

  const data = contests.map((c) => {
    const standings = computeStandings(c.entries, c);
    const byEntry = new Map(standings.map((s) => [s.entryId, s]));

    const pendingPicks = c.entries
      .flatMap((e) =>
        e.picks
          .filter((p) => p.result === "PENDING")
          .map((p) => ({
            id: p.id,
            entrantName: e.user.username ?? e.user.name ?? "Entrant",
            sport: p.sport,
            matchup: p.matchup,
            selection: p.selection,
            odds: p.odds,
            units: p.units,
            eventStartsAt: p.eventStartsAt.toISOString(),
          }))
      )
      .sort((a, b) => a.eventStartsAt.localeCompare(b.eventStartsAt));

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      status: c.status,
      minPicks: c.minPicks,
      startsAt: c.startsAt.toISOString(),
      endsAt: c.endsAt.toISOString(),
      prizePoolCents: c.prizePoolCents,
      prizeSplitDollars: c.prizeSplitCents.map((x) => x / 100),
      entryCount: c.entries.length,
      pendingPicks,
      entries: c.entries
        .map((e) => {
          const s = byEntry.get(e.id);
          return {
            id: e.id,
            name: e.user.username ?? e.user.name ?? "Entrant",
            rank: s?.rank ?? null,
            roi: s?.roi ?? null,
            unitsNet: s?.unitsNet ?? 0,
            record: s?.record ?? "0-0",
            settledPicks: s?.settledPicks ?? 0,
            qualified: s?.qualified ?? false,
            projectedPrizeCents: s?.prizeCents ?? 0,
            finalRank: e.finalRank,
            prizeCents: e.prizeCents,
            paidAt: e.paidAt?.toISOString() ?? null,
          };
        })
        .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || b.settledPicks - a.settledPicks),
    };
  });

  return (
    <ContestManager contests={data} defaultSplitDollars={DEFAULT_SUPERCAPPER_SPLIT_CENTS.map((c) => c / 100)} />
  );
}
