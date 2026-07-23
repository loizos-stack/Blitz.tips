import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Trophy, ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeStandings,
  computeStandingsAsOf,
  contestPhase,
  isContestAcceptingPicks,
  effectivePrizeLadderCents,
  activeEntrantCount,
} from "@/lib/contest";
import {
  computeQuotaUsage,
  startOfUtcDay,
  MAX_PICKS_PER_DAY,
  MAX_PICKS_PER_WEEK,
  MAX_UNITS_PER_DAY,
  type QuotaUsage,
} from "@/lib/contest-limits";
import { unitProfit } from "@/lib/odds";
import { formatCents, SPORT_LABELS } from "@/lib/utils";
import { ResultPill } from "@/components/result-pill";
import { LocalTime } from "@/components/local-time";
import { ContestCountdown } from "@/components/contest/contest-countdown";
import { ContestJoinButton } from "@/components/contest/contest-join-button";
import { ContestPickForm } from "@/components/contest/contest-pick-form";
import { ContestStandings } from "@/components/contest/contest-standings";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Contest Dashboard",
  robots: { index: false, follow: false },
};

const PHASE_LABEL: Record<string, string> = {
  upcoming: "Starts soon",
  live: "Live now",
  ended: "Grading in progress",
  settled: "Winners announced",
};

export default async function ContestDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/supercapper/dashboard");

  const contest = await prisma.contest.findUnique({
    where: { slug: "supercapper" },
    include: {
      entries: { include: { picks: true, user: { select: { name: true, username: true } } } },
    },
  });
  if (!contest) redirect("/supercapper");

  const phase = contestPhase(contest);
  const accepting = isContestAcceptingPicks(contest);
  const registrationClosesAt = contest.registrationClosesAt ?? contest.endsAt;
  const canJoin = contest.status === "OPEN" && new Date() <= registrationClosesAt;
  const prizeLadder = effectivePrizeLadderCents(contest, activeEntrantCount(contest.entries));
  const contestForStandings = { minPicks: contest.minPicks, prizeSplitCents: prizeLadder };
  const standings = computeStandings(contest.entries, contestForStandings);
  const myEntry = contest.entries.find((e) => e.userId === session.user.id);

  // Not entered yet: prompt to join from here.
  if (!myEntry) {
    return (
      <div className="container-page py-16">
        <BackLink />
        <div className="card mx-auto mt-6 max-w-lg p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-gold" />
          <h1 className="mt-4 text-2xl font-bold">You haven&apos;t entered yet</h1>
          <p className="mt-2 text-muted">
            Enter the {contest.name} — it&apos;s free — to start posting picks and climbing the leaderboard.
          </p>
          <div className="mt-6 flex justify-center">
            <ContestJoinButton
              contestId={contest.id}
              signedIn
              joined={false}
              accepting={canJoin}
              rules={{
                name: contest.name,
                minPicks: contest.minPicks,
                winners: prizeLadder.length,
                prizeLabel: formatCents(contest.prizePoolCents),
                dateRange: `${format(contest.startsAt, "MMM d, yyyy")} – ${format(contest.endsAt, "MMM d, yyyy")}`,
                registrationCloses: format(registrationClosesAt, "MMM d, yyyy"),
                dynamicPayouts: contest.dynamicPayouts,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const myStanding = standings.find((s) => s.entryId === myEntry.id);
  const prevRankByEntry = new Map(
    computeStandingsAsOf(contest.entries, contestForStandings, startOfUtcDay(new Date()).getTime()).map((s) => [
      s.entryId,
      s.rank,
    ])
  );
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
  const quota = computeQuotaUsage(myEntry.picks);
  const picks = [...myEntry.picks].sort((a, b) => b.eventStartsAt.getTime() - a.eventStartsAt.getTime());
  const pending = picks.filter((p) => p.result === "PENDING");
  const graded = picks.filter((p) => p.result !== "PENDING");

  return (
    <div className="container-page py-10">
      <BackLink />

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex text-3xl">
            <SupercapperLogo withContest />
          </h1>
          <p className="mt-1 text-sm text-muted">
            {PHASE_LABEL[phase]} · {format(contest.startsAt, "MMM d")}–{format(contest.endsAt, "MMM d, yyyy")} ·{" "}
            {formatCents(contest.prizePoolCents)} guaranteed
          </p>
        </div>
        {phase === "upcoming" && <ContestCountdown target={contest.startsAt.toISOString()} label="Starts in" />}
        {phase === "live" && <ContestCountdown target={contest.endsAt.toISOString()} label="Ends in" />}
      </div>

      {/* Your stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Rank" value={myStanding?.rank ? `#${myStanding.rank}` : "—"} />
        <StatTile
          label="ROI"
          value={myStanding?.roi != null ? `${myStanding.roi > 0 ? "+" : ""}${myStanding.roi.toFixed(1)}%` : "—"}
          tone={myStanding?.roi != null ? (myStanding.roi > 0 ? "pos" : myStanding.roi < 0 ? "neg" : undefined) : undefined}
        />
        <StatTile label="Record" value={myStanding?.record ?? "0-0"} />
        <StatTile
          label="Units"
          value={`${(myStanding?.unitsNet ?? 0) > 0 ? "+" : ""}${myStanding?.unitsNet ?? 0}u`}
          tone={(myStanding?.unitsNet ?? 0) > 0 ? "pos" : (myStanding?.unitsNet ?? 0) < 0 ? "neg" : undefined}
        />
        <StatTile label="Graded" value={`${myStanding?.settledPicks ?? 0}/${contest.minPicks}`} />
        <StatTile
          label={myStanding?.qualified ? "Prize (proj.)" : "Qualify in"}
          value={
            myStanding?.qualified
              ? myStanding.prizeCents > 0
                ? formatCents(myStanding.prizeCents)
                : "—"
              : `${Math.max(0, contest.minPicks - (myStanding?.settledPicks ?? 0))} picks`
          }
          tone={myStanding?.qualified && myStanding.prizeCents > 0 ? "gold" : undefined}
        />
      </div>

      {!myStanding?.qualified && (
        <p className="mt-3 rounded-lg border border-border bg-surface-raised p-3 text-sm text-muted">
          Post {Math.max(0, contest.minPicks - (myStanding?.settledPicks ?? 0))} more graded singles to qualify for the
          leaderboard and the prize pool.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]">
        {/* Make a pick */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <p className="mb-1 font-semibold">Make a pick</p>
            <p className="mb-3 text-xs text-muted">Single picks only — parlays aren&apos;t allowed in the contest.</p>
            {accepting ? (
              <ContestPickForm contestId={contest.id} />
            ) : (
              <p className="text-sm text-muted">
                {phase === "upcoming"
                  ? "Pick submission opens when the contest starts."
                  : "The contest isn't accepting picks right now."}
              </p>
            )}
          </div>

          <QuotaCard quota={quota} />
        </div>

        {/* Your picks + leaderboard */}
        <div className="flex flex-col gap-6">
          <div className="card p-0">
            <p className="px-5 pt-5 font-semibold">Your picks ({picks.length})</p>
            {picks.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted">No picks yet — submit your first single.</p>
            ) : (
              <div className="mt-3">
                {pending.length > 0 && <PickGroup title={`Pending (${pending.length})`} picks={pending} />}
                {graded.length > 0 && <PickGroup title={`Graded (${graded.length})`} picks={graded} showProfit />}
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 font-semibold">Leaderboard</p>
            <ContestStandings
              overall={overallStandings}
              entries={standingEntries}
              minPicks={contest.minPicks}
              myEntryId={myEntry.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type RowPick = {
  id: string;
  sport: string;
  matchup: string;
  selection: string;
  odds: number;
  units: number;
  result: "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";
  eventStartsAt: Date;
};

function PickGroup({ title, picks, showProfit }: { title: string; picks: RowPick[]; showProfit?: boolean }) {
  return (
    <div className="border-t border-border first:border-t-0">
      <p className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="divide-y divide-border">
        {picks.map((p) => {
          const profit = showProfit ? Math.round(unitProfit(p.odds, p.units, p.result) * 100) / 100 : null;
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.selection}</p>
                <p className="truncate text-xs text-muted">
                  {SPORT_LABELS[p.sport] ?? p.sport} · {p.matchup} · {p.odds > 0 ? `+${p.odds}` : p.odds} · {p.units}u ·{" "}
                  <LocalTime iso={p.eventStartsAt.toISOString()} />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {profit != null && (
                  <span className={`text-xs font-semibold tabular-nums ${profit > 0 ? "text-accent" : profit < 0 ? "text-danger" : "text-muted"}`}>
                    {profit > 0 ? "+" : ""}
                    {profit}u
                  </span>
                )}
                <ResultPill result={p.result} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuotaCard({ quota }: { quota: QuotaUsage }) {
  const rows = [
    { label: "Picks today", used: quota.picksToday, max: MAX_PICKS_PER_DAY, suffix: "" },
    { label: "Units today", used: quota.unitsToday, max: MAX_UNITS_PER_DAY, suffix: "u" },
    { label: "Picks this week", used: quota.picksThisWeek, max: MAX_PICKS_PER_WEEK, suffix: "" },
  ];
  return (
    <div className="card p-5">
      <p className="font-semibold">Your limits</p>
      <p className="mt-0.5 text-xs text-muted">
        Max {MAX_PICKS_PER_DAY} picks &amp; {MAX_UNITS_PER_DAY}u per day, {MAX_PICKS_PER_WEEK} picks per week.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map((r) => {
          const pct = Math.min(100, r.max > 0 ? (r.used / r.max) * 100 : 0);
          const full = r.used >= r.max;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{r.label}</span>
                <span className={`font-semibold tabular-nums ${full ? "text-danger" : ""}`}>
                  {r.used}
                  {r.suffix} / {r.max}
                  {r.suffix}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                <div className={`h-full rounded-full ${full ? "bg-danger" : "bg-accent"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Daily resets at midnight UTC · weekly resets Monday.
      </p>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "gold" }) {
  const color = tone === "pos" ? "text-accent" : tone === "neg" ? "text-danger" : tone === "gold" ? "text-gold" : "";
  return (
    <div className="card p-4">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/supercapper" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Contest overview
    </Link>
  );
}
