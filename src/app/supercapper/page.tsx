import type { Metadata } from "next";
import { SitePromoStrip } from "@/components/cross-promo-strip";
import { UsernameGate } from "@/components/contest/username-gate";
import { entrantAvatar } from "@/lib/contest-avatar";
import Link from "next/link";
import { format } from "date-fns";
import { Trophy, Coins, ListChecks, Gift, CalendarClock, Gauge, LayoutDashboard, ListOrdered, Users, Crown, Layers } from "lucide-react";
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
import { MAX_PICKS_PER_DAY, MAX_PICKS_PER_WEEK, MAX_UNITS_PER_DAY } from "@/lib/contest-limits";
import { ContestCountdown } from "@/components/contest/contest-countdown";
import { ContestJoinButton } from "@/components/contest/contest-join-button";
import { ContestStandings } from "@/components/contest/contest-standings";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supercapper Contest — $10,000 Guaranteed",
  description:
    "Enter the free Supercapper Contest for a shot at a $10,000 guaranteed prize pool. Post your picks, climb the ROI leaderboard, and finish top 20 to get paid.",
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
            user: {
              select: {
                name: true,
                username: true,
                image: true,
                handicapper: { select: { avatarUrl: true } },
              },
            },
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

  // Signed in but with no username yet (a Google signup who skipped
  // onboarding). The contest publishes the name you enter under, so claim it
  // before joining rather than falling back to their Google display name.
  const needsUsername = Boolean(
    session?.user?.id &&
      !(
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { username: true },
        })
      )?.username
  );

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
    avatarUrl: s.avatarUrl,
    rank: s.rank,
    previousRank: prevRankByEntry.get(s.entryId) ?? null,
    qualified: s.qualified,
    roi: s.roi,
    adjustedRoi: s.adjustedRoi,
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
      avatarUrl: entrantAvatar({
        entryAvatarUrl: e.avatarUrl,
        handicapperAvatarUrl: e.user.handicapper?.avatarUrl,
        userImage: e.user.image,
      }),
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
      <section className="relative overflow-hidden border-b border-white/10 bg-[#0b0f14] text-white">
        {/* Dark hero: the contest has its own identity, and the gold mark and
            prize figure carry far more weight on charcoal than on the site's
            light chrome. Matches the promo banner and the social graphics. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-bottom opacity-20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(34,197,94,0.18),transparent_60%),radial-gradient(90%_70%_at_80%_100%,rgba(234,179,8,0.14),transparent_60%)]"
        />
        <div className="container-page relative py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-1 text-xs font-semibold text-[#eab308]">
            <Trophy className="h-3.5 w-3.5" /> {PHASE_LABEL[phase]}
          </span>
          <h1 className="mt-6 flex justify-center text-5xl md:text-7xl">
            <SupercapperLogo withContest withByline onDark />
          </h1>
          {contest.tagline && <p className="mt-4 text-lg text-white/70">{contest.tagline}</p>}

          <div className="mt-8 flex flex-col items-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/60">Guaranteed prize pool</p>
            <p className="font-display text-5xl font-extrabold text-[#eab308] md:text-7xl">
              {formatCents(contest.prizePoolCents)}
            </p>
            <p className="mt-2 text-sm text-white/60">{dateRange}</p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-6">
            {phase === "upcoming" && (
              <ContestCountdown target={contest.startsAt.toISOString()} label="Contest starts in" onDark />
            )}
            {phase === "live" && (
              <ContestCountdown target={contest.endsAt.toISOString()} label="Contest ends in" onDark />
            )}
            {myEntry ? (
              // Already entered: skip the "entered" button and send them where they
              // actually want to go — their dashboard, or the full standings.
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/supercapper/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
                >
                  <LayoutDashboard className="h-4 w-4" /> Your dashboard
                </Link>
                <Link
                  href="/supercapper/standings"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:border-white/50"
                >
                  <ListOrdered className="h-4 w-4" /> Full standings
                </Link>
                <Link
                  href="/supercapper/consensus"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:border-white/50"
                >
                  <Users className="h-4 w-4" /> Consensus
                </Link>
              </div>
            ) : needsUsername ? (
              <UsernameGate />
            ) : (
              <ContestJoinButton
                contestId={contest.id}
                signedIn={Boolean(session?.user)}
                joined={false}
                accepting={canJoin}
                rules={{
                  name: contest.name,
                  minPicks: contest.minPicks,
                  winners,
                  prizeLabel: formatCents(contest.prizePoolCents),
                  dateRange,
                  registrationCloses: regClosesLabel,
                  dynamicPayouts: contest.dynamicPayouts,
                }}
              />
            )}
          </div>
        </div>
      </section>

      <SitePromoStrip />

      {/* Prize breakdown */}
      <section className="relative overflow-hidden border-b border-border py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/10 via-transparent to-transparent" />
        <div className="container-page relative">
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

      {/* How it works & rules */}
      <section className="relative overflow-hidden border-b border-border bg-surface/40 py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/lines-bg.svg')] bg-cover bg-center opacity-[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-gold/[0.07]"
        />
        <div className="container-page relative">
          <h2 className="text-center text-2xl font-bold">How it works &amp; rules</h2>
          <p className="mt-2 text-center text-sm text-muted">
            Everything you need to know — you agree to the full rules when you enter.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Free entry and the one-account rule belong together: "it's free"
                invites the obvious follow-up "so what stops ten accounts?", and
                answering it in the same box is more convincing than burying the
                integrity rule at the end. */}
            <Rule
              icon={<Gift className="h-5 w-5" />}
              title="Free to enter · one account each"
              body="No buy-in, no catch — sign in, hit enter, start posting picks. One entry per person: we log the IP and device on every entry and every pick, and duplicate accounts, shared IPs or collusion are disqualified and forfeit any prize."
            />
            <Rule icon={<Coins className="h-5 w-5" />} title="Best ROI wins" body="Ranked by volume-adjusted ROI — return on units risked, weighted by how many picks you post. Consistency all season beats a lucky short run." />
            <Rule
              icon={<ListChecks className="h-5 w-5" />}
              title={`${contest.minPicks} picks for prize eligibility`}
              body={`Anyone can enter and post picks. To be eligible for the prize pool you need ${contest.minPicks} graded single picks. Parlays aren't allowed, and you can't post on a game that's already started.`}
            />
            <Rule
              icon={<Layers className="h-5 w-5" />}
              title="Every market counts"
              body="Pick straight off the live board: moneylines, spreads and handicaps, totals, alternate lines, 1st half / quarter / period markets, and player props — everything we price is fair game."
            />
            <Rule
              icon={<Trophy className="h-5 w-5" />}
              title={contest.dynamicPayouts ? "Paid places grow" : `Top ${winners} get paid`}
              body={
                contest.dynamicPayouts
                  ? `The ${formatCents(contest.prizePoolCents)} pool starts across the top 3 and adds a place for every 10 cappers who join. Currently ${winners} paid.`
                  : `The ${formatCents(contest.prizePoolCents)} pool is split across the top ${winners} finishers.`
              }
            />
            <Rule
              icon={<Crown className="h-5 w-5" />}
              title={`Supercapper crowned ${format(contest.endsAt, "MMM d, yyyy")}`}
              body={`Picks run all the way to ${format(contest.endsAt, "MMM d, yyyy")}. That's when final ROI standings lock, the ICM prizes are calculated, and the top capper takes the crown.`}
            />
            <Rule
              icon={<CalendarClock className="h-5 w-5" />}
              title={`Registration closes ${regClosesLabel}`}
              body="Enter before then. Once entries close, the field — and the number of paid places — is locked for the rest of the contest."
            />
            <Rule
              icon={<Gauge className="h-5 w-5" />}
              title="Daily & weekly limits"
              body={`Max ${MAX_PICKS_PER_DAY} picks and ${MAX_UNITS_PER_DAY} units per day, and ${MAX_PICKS_PER_WEEK} picks per week. Limits reset daily at midnight UTC and weekly on Monday.`}
            />
          </div>
        </div>
      </section>

      {/* Standings */}
      <section className="relative overflow-hidden py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />
        <div className="container-page relative">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">In the money</h2>
              <p className="mt-1 text-sm text-muted">
                The {winners} paid place{winners === 1 ? "" : "s"} as it stands. Ranked by
                volume-adjusted ROI — your ROI counts more the more picks you post. Entrants need{" "}
                {contest.minPicks} graded picks to qualify. Prizes are auto-calculated per ICM by finishing rank.
              </p>
            </div>
            {myEntry && (
              <Link href="/supercapper/dashboard" className="text-sm font-medium text-accent hover:underline">
                Your dashboard →
              </Link>
            )}
          </div>
          <div className="mt-6">
            {/* Paid places only. The whole field lives on the standings page —
                a hundred rows at the bottom of a landing page buries the CTA. */}
            <ContestStandings
              overall={overallStandings}
              entries={standingEntries}
              minPicks={contest.minPicks}
              myEntryId={myEntry?.id}
              limit={winners}
            />
          </div>
          <div className="mt-6 flex justify-center">
            <Link
              href="/supercapper/standings"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:border-accent"
            >
              <ListOrdered className="h-4 w-4" /> Full standings
              {overallStandings.length > winners && (
                <span className="text-muted">· all {overallStandings.length} entrants</span>
              )}
            </Link>
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
