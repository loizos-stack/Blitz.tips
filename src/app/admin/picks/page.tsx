import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatOdds } from "@/lib/odds";
import { AdminSelect, AdminButton } from "@/components/admin/admin-actions";
import { PickCorrection } from "@/components/admin/pick-correction";
import { LocalTime } from "@/components/local-time";
import { guardAdminPage } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RESULT_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "WIN", label: "Win" },
  { value: "LOSS", label: "Loss" },
  { value: "PUSH", label: "Push" },
  { value: "VOID", label: "Void" },
];

const ROW_LIMIT = 150;

type ViewKey = "tograde" | "manual" | "all" | "pending" | "WIN" | "LOSS" | "PUSH" | "VOID";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "tograde", label: "To grade" },
  { key: "manual", label: "Typed by hand" },
  { key: "pending", label: "Pending" },
  { key: "all", label: "All" },
  { key: "WIN", label: "Win" },
  { key: "LOSS", label: "Loss" },
  { key: "PUSH", label: "Push" },
  { key: "VOID", label: "Void" },
];

function isViewKey(v: string | undefined): v is ViewKey {
  return VIEWS.some((o) => o.key === v);
}

/**
 * The rows each view asks for.
 *
 * "To grade" is the one that earns its place: pending is not the same as
 * needing attention. A pick on a game that hasn't started yet is pending
 * because it is supposed to be, and in season those outnumber the ones
 * actually waiting on someone. The cut is kickoff — the same rule
 * isGradableByHandicapper applies on the dashboard and the settle endpoint, so
 * the admin queue and the handicapper's own buttons never disagree about what
 * is grade-able.
 */
function whereFor(view: ViewKey, now: Date): Prisma.PickWhereInput {
  switch (view) {
    case "all":
      return {};
    case "pending":
      return { result: "PENDING" };
    case "tograde":
      return { result: "PENDING", eventStartsAt: { lte: now } };
    // Picks nobody took off the odds board. They carry no event id, so the
    // settler has no score to look up and has to grade them from their own
    // wording — which is where wrong and ungraded results come from. This is
    // the view that says who is still doing it.
    case "manual":
      return { oddsApiEventId: null };
    default:
      return { result: view };
  }
}

export default async function AdminPicksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await guardAdminPage("picks");

  const params = await searchParams;
  const view: ViewKey = isViewKey(params.view) ? params.view : "all";
  const now = new Date();

  const [picks, byResult, toGradeCount, total, manualCount] = await Promise.all([
    prisma.pick.findMany({
      where: whereFor(view, now),
      // The grading queue is ordered by kickoff, oldest first: the game that
      // finished longest ago is the one that has been waiting longest. Every
      // other view is a log, so it reads newest-first by when it was posted.
      orderBy: view === "tograde" ? { eventStartsAt: "asc" } : { createdAt: "desc" },
      take: ROW_LIMIT,
      include: { handicapper: { select: { handle: true, userId: true } } },
    }),
    prisma.pick.groupBy({ by: ["result"], _count: { _all: true } }),
    prisma.pick.count({ where: { result: "PENDING", eventStartsAt: { lte: now } } }),
    prisma.pick.count(),
    prisma.pick.count({ where: { oddsApiEventId: null } }),
  ]);

  // Counts on the pills, so the queue can be read without clicking into it.
  const counts: Record<ViewKey, number> = {
    tograde: toGradeCount,
    manual: manualCount,
    pending: byResult.find((r) => r.result === "PENDING")?._count._all ?? 0,
    all: total,
    WIN: byResult.find((r) => r.result === "WIN")?._count._all ?? 0,
    LOSS: byResult.find((r) => r.result === "LOSS")?._count._all ?? 0,
    PUSH: byResult.find((r) => r.result === "PUSH")?._count._all ?? 0,
    VOID: byResult.find((r) => r.result === "VOID")?._count._all ?? 0,
  };

  // Self-graded picks are the integrity risk — label them so they stand out
  // from admin- and score-settled results.
  const settledByLabel = (p: (typeof picks)[number]) =>
    !p.settledBy ? (
      <span className="text-muted">—</span>
    ) : p.settledBy === "auto" ? (
      <span className="text-accent">Auto (score)</span>
    ) : p.settledBy === p.handicapper.userId ? (
      <span className="text-gold">Self</span>
    ) : (
      <span>Admin</span>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => {
          const active = v.key === view;
          const empty = counts[v.key] === 0;
          return (
            <Link
              key={v.key}
              href={v.key === "all" ? "/admin/picks" : `/admin/picks?view=${v.key}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              {v.label}
              <span
                className={cn(
                  "tabular-nums",
                  active
                    ? "opacity-70"
                    : // A grading queue with work in it should read as work; at
                      // zero it is just another count.
                      v.key === "tograde" && !empty
                      ? "font-semibold text-gold"
                      : "opacity-60"
                )}
              >
                {counts[v.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[68rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Capper</th>
              <th className="px-4 py-3">Matchup</th>
              <th className="px-4 py-3">Selection</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Odds</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Posted</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Settled by</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 font-medium">@{p.handicapper.handle}</td>
                <td className="max-w-44 truncate px-4 py-2.5 font-display">{p.matchup}</td>
                <td className="max-w-44 truncate px-4 py-2.5 font-display text-muted">
                  {p.selection}
                </td>
                {/* Where the pick came from. A board pick carries the event id
                    the settler looks a score up by; a hand-typed one doesn't,
                    and has to be graded from its wording. */}
                <td className="px-4 py-2.5 text-xs">
                  {p.oddsApiEventId ? (
                    <span className="text-muted">Board</span>
                  ) : (
                    <span className="font-medium text-gold">By hand</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{formatOdds(p.odds)}</td>
                <td className="px-4 py-2.5 tabular-nums">{p.units}u</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  <LocalTime iso={p.createdAt.toISOString()} />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                  <LocalTime iso={p.eventStartsAt.toISOString()} />
                </td>
                <td className="px-4 py-2.5">
                  <AdminSelect
                    endpoint={`/api/admin/picks/${p.id}`}
                    field="result"
                    value={p.result}
                    options={RESULT_OPTIONS}
                  />
                </td>
                <td className="px-4 py-2.5 text-xs">{settledByLabel(p)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <PickCorrection
                      id={p.id}
                      matchup={p.matchup}
                      selection={p.selection}
                      playerName={p.playerName}
                      linePoint={p.linePoint}
                      odds={p.odds}
                      units={p.units}
                      result={p.result}
                    />
                    <AdminButton
                      endpoint={`/api/admin/picks/${p.id}`}
                      method="DELETE"
                      label="Delete"
                      tone="danger"
                      confirmText="Delete this pick from the record? This cannot be undone."
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {picks.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {view === "tograde"
              ? "Nothing waiting. Every pick whose game has started is graded."
              : view === "manual"
                ? "Every pick came off the odds board — nothing was typed by hand."
                : "No picks in this view."}
          </p>
        ) : null}
      </div>

      {counts[view] > picks.length ? (
        <p className="text-xs text-muted">
          Showing {picks.length} of {counts[view]}
          {view === "tograde" ? ", oldest kickoff first." : ", most recently posted first."}
        </p>
      ) : null}
    </div>
  );
}
