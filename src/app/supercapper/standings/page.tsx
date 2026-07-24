import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeStandings,
  computeStandingsAsOf,
  contestPhase,
  effectivePrizeLadderCents,
  activeEntrantCount,
} from "@/lib/contest";
import { startOfUtcDay } from "@/lib/contest-limits";
import { formatCents } from "@/lib/utils";
import { ContestStandings } from "@/components/contest/contest-standings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supercapper Contest — Full Standings",
  description: "The full Supercapper Contest leaderboard: filter by overall, today, yesterday, this week, or this month.",
  alternates: { canonical: "/supercapper/standings" },
};

const PHASE_LABEL: Record<string, string> = {
  upcoming: "Starts soon",
  live: "Live now",
  ended: "Grading in progress",
  settled: "Winners announced",
};

export default async function SupercapperStandingsPage() {
  const [session, contest] = await Promise.all([
    auth(),
    prisma.contest.findUnique({
      where: { slug: "supercapper" },
      include: {
        entries: { include: { picks: true, user: { select: { name: true, username: true } } } },
      },
    }),
  ]);
  if (!contest) redirect("/supercapper");

  const phase = contestPhase(contest);
  const prizeLadder = effectivePrizeLadderCents(contest, activeEntrantCount(contest.entries));
  const contestForStandings = { minPicks: contest.minPicks, prizeSplitCents: prizeLadder };
  const standings = computeStandings(contest.entries, contestForStandings);
  const prevRankByEntry = new Map(
    computeStandingsAsOf(contest.entries, contestForStandings, startOfUtcDay(new Date()).getTime()).map((s) => [
      s.entryId,
      s.rank,
    ])
  );
  const myEntry = session?.user?.id ? contest.entries.find((e) => e.userId === session.user.id) : undefined;

  const overallStandings = standings.map((s) => ({
    entryId: s.entryId,
    name: s.name,
    rank: s.rank,
    previousRank: prevRankByEntry.get(s.entryId) ?? null,
    qualified: s.qualified,
    roi: s.roi,
    unitsNet: s.unitsNet,
    record: s.record,
    settledPicks: s.settledPicks,
    prizeCents: s.prizeCents,
  }));
  const standingEntries = contest.entries
    .filter((e) => !e.disqualifiedAt)
    .map((e) => ({
      entryId: e.id,
      name: e.user.username ?? e.user.name ?? "Entrant",
      picks: e.picks.map((p) => ({
        odds: p.odds,
        units: p.units,
        result: p.result,
        eventStartsAt: p.eventStartsAt.toISOString(),
      })),
    }));

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-center opacity-[0.06]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
      <div className="container-page relative py-10">
        <Link
          href="/supercapper"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Contest overview
        </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Full standings</h1>
          <p className="mt-1 text-sm text-muted">
            {PHASE_LABEL[phase]} · {format(contest.startsAt, "MMM d")}–{format(contest.endsAt, "MMM d, yyyy")} ·{" "}
            {formatCents(contest.prizePoolCents)} guaranteed · {overallStandings.length} entrants
          </p>
        </div>
        {myEntry && (
          <Link
            href="/supercapper/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <LayoutDashboard className="h-4 w-4" /> Your dashboard
          </Link>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">
        Ranked by ROI over settled picks. Entrants need {contest.minPicks} graded picks to qualify; prizes are
        auto-calculated per ICM by finishing rank. Tap a name to see that entrant&apos;s picks and rank history.
      </p>

        <div className="mt-6">
          <ContestStandings
            overall={overallStandings}
            entries={standingEntries}
            minPicks={contest.minPicks}
            myEntryId={myEntry?.id}
          />
        </div>
      </div>
    </div>
  );
}
