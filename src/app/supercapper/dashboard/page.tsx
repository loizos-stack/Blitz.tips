import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Trophy, ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeStandings, contestPhase, isContestAcceptingPicks } from "@/lib/contest";
import { unitProfit } from "@/lib/odds";
import { formatCents, SPORT_LABELS } from "@/lib/utils";
import { ResultPill } from "@/components/result-pill";
import { LocalTime } from "@/components/local-time";
import { ContestCountdown } from "@/components/contest/contest-countdown";
import { ContestJoinButton } from "@/components/contest/contest-join-button";
import { ContestPickForm } from "@/components/contest/contest-pick-form";

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
  const canJoin = contest.status === "OPEN" && new Date() <= contest.endsAt;
  const standings = computeStandings(contest.entries, contest);
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
            <ContestJoinButton contestId={contest.id} signedIn joined={false} accepting={canJoin} />
          </div>
        </div>
      </div>
    );
  }

  const myStanding = standings.find((s) => s.entryId === myEntry.id);
  const picks = [...myEntry.picks].sort((a, b) => b.eventStartsAt.getTime() - a.eventStartsAt.getTime());
  const pending = picks.filter((p) => p.result === "PENDING");
  const graded = picks.filter((p) => p.result !== "PENDING");

  return (
    <div className="container-page py-10">
      <BackLink />

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Trophy className="h-6 w-6 text-gold" /> {contest.name}
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

          <div className="card p-0">
            <p className="px-5 pt-5 font-semibold">Leaderboard</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Entrant</th>
                    <th className="px-4 py-2.5 text-right">ROI</th>
                    <th className="px-4 py-2.5 text-right">Units</th>
                    <th className="px-4 py-2.5 text-right">Graded</th>
                    <th className="px-4 py-2.5 text-right">Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr
                      key={s.entryId}
                      className={`border-b border-border last:border-b-0 ${s.entryId === myEntry.id ? "bg-accent/10" : ""}`}
                    >
                      <td className="px-4 py-2 font-semibold text-muted">{s.rank ?? "—"}</td>
                      <td className="px-4 py-2 font-medium">
                        {s.name}
                        {s.entryId === myEntry.id && <span className="ml-1.5 text-xs font-semibold text-accent">You</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {s.roi != null ? `${s.roi > 0 ? "+" : ""}${s.roi.toFixed(1)}%` : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums ${s.unitsNet > 0 ? "text-accent" : s.unitsNet < 0 ? "text-danger" : ""}`}>
                        {s.unitsNet > 0 ? "+" : ""}{s.unitsNet}u
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">
                        {s.qualified ? s.settledPicks : `${s.settledPicks}/${contest.minPicks}`}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-gold">
                        {s.prizeCents > 0 ? formatCents(s.prizeCents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          const profit = showProfit ? unitProfit(p.odds, p.units, p.result) : null;
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
