import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Trophy, ShieldCheck, Coins, ListChecks, Gift, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeStandings,
  computeStandingsAsOf,
  contestPhase,
  contestIcmPayoutsCents,
  effectivePrizeLadderCents,
  activeEntrantCount,
  entrantsUntilNextSpot,
} from "@/lib/contest";
import { startOfUtcDay } from "@/lib/contest-limits";
import { formatCents } from "@/lib/utils";
import { ContestCountdown } from "@/components/contest/contest-countdown";
import { ContestJoinButton } from "@/components/contest/contest-join-button";
import { ContestStandings } from "@/components/contest/contest-standings";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supercapper Contest — $25,000 Guaranteed",
  description:
    "Enter the free Supercapper Contest for a shot at a $25,000 guaranteed prize pool. Post your picks, climb the ROI leaderboard, and finish top 20 to get paid.",
  alternates: { canonical: "/supercapper" },
};

const PHASE_LABEL: Record<string, string> = {
  upcoming: "Starts soon",
  live: "Live now",
  ended: "Grading in progress",
  settled: "Winners announced",
};

export default async function SupercapperPage() {
  const [session, contest] = await Promise.all([
    auth(),
    prisma.contest.findUnique({
      where: { slug: "supercapper" },
      include: {
        entries: {
          include: {
            picks: true,
            user: { select: { name: true, username: true } },
          },
        },
      },
    }),
  ]);

  if (!contest) {
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl font-bold">No active contest</h1>
        <p className="mt-3 text-muted">Check back soon — a new contest is on the way.</p>
      </div>
    );
  }

  const phase = contestPhase(contest);
  // Registration closes on its own date (Sep 27 for Supercapper); joining stays
  // open until then even though the contest itself runs longer.
  const registrationClosesAt = contest.registrationClosesAt ?? contest.endsAt;
  // Entries (pre-registration) open as soon as the contest is OPEN and before
  // registration closes — even during the pre-start window. Picks wait for kickoff.
  const canJoin = contest.status === "OPEN" && new Date() <= registrationClosesAt;

  // Paid places (and the prize ladder) scale with how many people have joined.
  const activeCount = activeEntrantCount(contest.entries);
  const prizeLadder = effectivePrizeLadderCents(contest, activeCount);
  const contestForStandings = { minPicks: contest.minPicks, prizeSplitCents: prizeLadder };
  const standings = computeStandings(contest.entries, contestForStandings);
  const winners = prizeLadder.length;
  // The published payout ladder is the ICM chop across the currently open places.
  const payoutLadder = contestIcmPayoutsCents(winners, prizeLadder);
  const registrationOpen = contest.status === "OPEN" && new Date() <= registrationClosesAt;
  const untilNextSpot = contest.dynamicPayouts ? entrantsUntilNextSpot(activeCount) : 0;

  const myEntry = session?.user?.id
    ? contest.entries.find((e) => e.userId === session.user.id)
    : undefined;

  // Where each entrant stood as of the start of today, to show rank movement.
  const prevRankByEntry = new Map(
    computeStandingsAsOf(contest.entries, contestForStandings, startOfUtcDay(new Date()).getTime()).map((s) => [
      s.entryId,
      s.rank,
    ])
  );

  // Serializable data for the interactive (window-filtered) standings table.
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

  const dateRange = `${format(contest.startsAt, "MMM d, yyyy")} – ${format(contest.endsAt, "MMM d, yyyy")}`;
  const regClosesLabel = format(registrationClosesAt, "MMM d, yyyy");

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-bottom" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="container-page relative py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
            <Trophy className="h-3.5 w-3.5" /> {PHASE_LABEL[phase]}
          </span>
          <h1 className="mt-6 flex justify-center text-5xl md:text-7xl">
            <SupercapperLogo withContest />
          </h1>
          {contest.tagline && <p className="mt-4 text-lg text-muted">{contest.tagline}</p>}

          <div className="mt-8 flex flex-col items-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Guaranteed prize pool</p>
            <p className="font-display text-5xl font-extrabold text-accent md:text-7xl">
              {formatCents(contest.prizePoolCents)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {dateRange} · Top {winners} paid · Free to enter
            </p>
            {contest.dynamicPayouts && (
              <p className="mt-1 text-xs text-muted">
                {registrationOpen ? (
                  <>
                    Paid places grow as cappers join — one more for every 10 entrants.{" "}
                    <span className="font-semibold text-foreground">{activeCount} in</span>, {untilNextSpot} more opens place #
                    {winners + 1}. Registration closes {regClosesLabel}.
                  </>
                ) : (
                  <>Registration closed {regClosesLabel} — {winners} paid places locked in.</>
                )}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-6">
            {phase === "upcoming" && <ContestCountdown target={contest.startsAt.toISOString()} label="Contest starts in" />}
            {phase === "live" && <ContestCountdown target={contest.endsAt.toISOString()} label="Contest ends in" />}
            <ContestJoinButton
              contestId={contest.id}
              signedIn={Boolean(session?.user)}
              joined={Boolean(myEntry)}
              accepting={canJoin}
              rules={{
                name: contest.name,
                minPicks: contest.minPicks,
                winners,
                prizeLabel: formatCents(contest.prizePoolCents),
                dateRange,
              }}
            />
            {myEntry && (
              <Link
                href="/supercapper/dashboard"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
              >
                Open your contest dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border bg-surface/40 py-14">
        <div className="container-page">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Rule icon={<Gift className="h-5 w-5" />} title="Free to enter" body="No buy-in, no catch. Sign in, hit enter, and start posting picks." />
            <Rule icon={<Coins className="h-5 w-5" />} title="Best ROI wins" body="You're ranked by return on units risked across your settled picks — not just raw wins." />
            <Rule icon={<ListChecks className="h-5 w-5" />} title={`${contest.minPicks}-pick minimum`} body={`Post at least ${contest.minPicks} graded singles to qualify, so nobody wins on a lucky one-off.`} />
            <Rule
              icon={<ShieldCheck className="h-5 w-5" />}
              title={contest.dynamicPayouts ? "Paid places grow" : `Top ${winners} get paid`}
              body={
                contest.dynamicPayouts
                  ? `The ${formatCents(contest.prizePoolCents)} pool starts across the top 3 and adds a place for every 10 cappers who join. Currently ${winners} paid.`
                  : `The ${formatCents(contest.prizePoolCents)} pool is split across the top ${winners} finishers.`
              }
            />
          </div>
        </div>
      </section>

      {/* Prize breakdown */}
      <section className="border-b border-border py-14">
        <div className="container-page">
          <h2 className="text-center text-2xl font-bold">Prize breakdown</h2>
          <p className="mt-2 text-center text-sm text-muted">
            {formatCents(contest.prizePoolCents)} guaranteed across {winners} place{winners === 1 ? "" : "s"} · payouts
            auto-calculated per ICM by finishing rank.
          </p>
          {contest.dynamicPayouts && (
            <p className="mx-auto mt-1 max-w-2xl text-center text-xs text-muted">
              {registrationOpen
                ? `Places scale with entries — ${activeCount} joined, ${untilNextSpot} more opens place #${winners + 1}. Prizes re-calculate as cappers join and lock when registration closes ${regClosesLabel}.`
                : `Registration closed ${regClosesLabel}. Final places and prizes are locked.`}
            </p>
          )}
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {payoutLadder.map((cents, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  i === 0 ? "border-gold/50 bg-gold/5" : "border-border"
                }`}
              >
                <span className="text-sm font-semibold text-muted">
                  {i === 0 ? "🥇 1st" : i === 1 ? "🥈 2nd" : i === 2 ? "🥉 3rd" : ordinal(i + 1)}
                </span>
                <span className="font-display font-bold tabular-nums">{formatCents(cents)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Standings */}
      <section className="py-14">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Standings</h2>
              <p className="mt-1 text-sm text-muted">
                Ranked by ROI over settled picks. Entrants need {contest.minPicks} graded picks to qualify.
                Prizes are auto-calculated per ICM by finishing rank.
              </p>
            </div>
            {myEntry && (
              <Link href="/supercapper/dashboard" className="text-sm font-medium text-accent hover:underline">
                Your dashboard →
              </Link>
            )}
          </div>
          <div className="mt-6">
            <ContestStandings
              overall={overallStandings}
              entries={standingEntries}
              minPicks={contest.minPicks}
              myEntryId={myEntry?.id}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// Correct ordinal suffix (1st, 2nd, 3rd, 4th … 21st, 22nd, 23rd …).
function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function Rule({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
