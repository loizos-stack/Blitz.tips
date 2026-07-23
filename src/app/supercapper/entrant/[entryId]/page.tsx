import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeStandings, contestPhase, entrantRankHistory } from "@/lib/contest";
import { formatCents } from "@/lib/utils";
import { EntrantDetail } from "@/components/contest/entrant-detail";
import { RankChart } from "@/components/contest/rank-chart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contest entrant",
  robots: { index: false, follow: false },
};

export default async function EntrantPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;

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

  const entry = contest.entries.find((e) => e.id === entryId);
  if (!entry) notFound();

  const standings = computeStandings(contest.entries, contest);
  const standing = standings.find((s) => s.entryId === entry.id);
  const history = entrantRankHistory(contest.entries, entry.id, contest.startsAt, contest.endsAt);
  const phase = contestPhase(contest);

  const name = entry.user.username ?? entry.user.name ?? "Entrant";
  const disqualified = Boolean(entry.disqualifiedAt);
  const isMe = session?.user?.id === entry.userId;

  const picks = entry.picks.map((p) => ({
    id: p.id,
    sport: p.sport,
    matchup: p.matchup,
    selection: p.selection,
    odds: p.odds,
    units: p.units,
    result: p.result,
    eventStartsAt: p.eventStartsAt.toISOString(),
  }));

  return (
    <div className="container-page py-10">
      <Link
        href="/supercapper"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Standings
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            {name}
            {isMe && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">You</span>}
            {disqualified && (
              <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">Disqualified</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {contest.name} · {format(contest.startsAt, "MMM d")}–{format(contest.endsAt, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-semibold text-gold">
            <Trophy className="h-4 w-4" />
            {disqualified
              ? "Out"
              : standing?.rank
                ? `Overall #${standing.rank}`
                : `${standing?.settledPicks ?? 0}/${contest.minPicks} to qualify`}
          </span>
          {!disqualified && standing?.qualified && standing.prizeCents > 0 && (
            <span className="mt-1 text-xs text-muted">
              Projected prize {formatCents(standing.prizeCents)}
            </span>
          )}
        </div>
      </div>

      {isMe && (
        <Link
          href="/supercapper/dashboard"
          className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline"
        >
          Go to your dashboard →
        </Link>
      )}

      {/* Rank over time */}
      <div className="mt-8">
        <RankChart points={history} />
      </div>

      {/* Window-filtered stats + picks */}
      <div className="mt-8">
        <EntrantDetail picks={picks} />
      </div>

      {phase === "settled" && !disqualified && standing?.rank && (
        <p className="mt-6 text-sm text-muted">Final finish: #{standing.rank}.</p>
      )}
    </div>
  );
}
