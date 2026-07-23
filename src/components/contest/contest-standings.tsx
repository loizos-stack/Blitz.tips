"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { computeStats } from "@/lib/odds";
import { CONTEST_WINDOWS, filterPicksByWindow, type ContestWindowKey } from "@/lib/contest-windows";
import { formatCents, cn } from "@/lib/utils";

type PickResult = "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";

export interface StandingPick {
  odds: number;
  units: number;
  result: PickResult;
  eventStartsAt: string;
}

export interface StandingEntry {
  entryId: string;
  name: string;
  picks: StandingPick[];
}

// The authoritative overall standing (rank, ICM prize, min-pick qualification)
// as computed on the server — used verbatim for the "Overall" tab.
export interface OverallStanding {
  entryId: string;
  name: string;
  rank: number | null;
  // The entrant's rank as of the start of today (null if unranked then).
  previousRank: number | null;
  qualified: boolean;
  roi: number | null;
  unitsNet: number;
  record: string;
  settledPicks: number;
  prizeCents: number;
}

interface Row {
  entryId: string;
  name: string;
  rank: number | null;
  // Movement vs. the start of today; undefined in windowed views (no baseline).
  previousRank?: number | null;
  roi: number | null;
  unitsNet: number;
  record: string;
  settledPicks: number;
  qualifiedLabel: string; // what to show in the "Graded" column
  prizeCents: number;
}

export function ContestStandings({
  overall,
  entries,
  minPicks,
  myEntryId,
  linkBase = "/supercapper/entrant",
  showPrize = true,
}: {
  overall: OverallStanding[];
  entries: StandingEntry[];
  minPicks: number;
  myEntryId?: string;
  linkBase?: string;
  showPrize?: boolean;
}) {
  const [window, setWindow] = useState<ContestWindowKey>("overall");

  const rows: Row[] = useMemo(() => {
    if (window === "overall") {
      return overall.map((s) => ({
        entryId: s.entryId,
        name: s.name,
        rank: s.rank,
        previousRank: s.previousRank,
        roi: s.roi,
        unitsNet: s.unitsNet,
        record: s.record,
        settledPicks: s.settledPicks,
        qualifiedLabel: s.qualified ? String(s.settledPicks) : `${s.settledPicks}/${minPicks}`,
        prizeCents: s.prizeCents,
      }));
    }

    // Windowed views rank by ROI over the picks whose game falls in the window.
    // There's no min-pick floor and no prize here — it's a form guide, not the
    // money standing — so anyone with a graded pick in the window is ranked.
    const now = new Date();
    const computed = entries.map((e) => {
      const windowPicks = filterPicksByWindow(e.picks, window, now);
      const stats = computeStats(windowPicks);
      const settledPicks = stats.wins + stats.losses + stats.pushes;
      return {
        entryId: e.entryId,
        name: e.name,
        roi: stats.roi,
        unitsNet: stats.unitsNet,
        record: stats.record,
        settledPicks,
      };
    });

    const ranked = computed
      .filter((r) => r.settledPicks > 0)
      .sort(
        (a, b) =>
          (b.roi ?? -Infinity) - (a.roi ?? -Infinity) ||
          b.unitsNet - a.unitsNet ||
          b.settledPicks - a.settledPicks ||
          a.name.localeCompare(b.name)
      )
      .map((r, i) => ({ ...r, rank: i + 1, qualifiedLabel: String(r.settledPicks), prizeCents: 0 }));

    const rest = computed
      .filter((r) => r.settledPicks === 0)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => ({ ...r, rank: null, qualifiedLabel: "0", prizeCents: 0 }));

    return [...ranked, ...rest];
  }, [window, overall, entries, minPicks]);

  const hasRankedRows = rows.some((r) => r.rank != null);

  return (
    <div>
      {/* window pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CONTEST_WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={() => setWindow(w.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              window === w.key
                ? "bg-accent text-accent-foreground"
                : "border border-border text-muted hover:border-muted hover:text-foreground"
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-muted">No entries yet — be the first to set the pace.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Entrant</th>
                <th className="px-4 py-3 text-right">ROI</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Record</th>
                <th className="px-4 py-3 text-right">Graded</th>
                {showPrize && <th className="px-4 py-3 text-right">Prize</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.entryId}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    myEntryId && r.entryId === myEntryId && "bg-accent/5"
                  )}
                >
                  <td className="px-4 py-2.5 font-semibold text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      {r.rank ?? "—"}
                      {window === "overall" && r.rank != null && <RankMove rank={r.rank} previousRank={r.previousRank} />}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`${linkBase}/${r.entryId}`} className="hover:text-accent hover:underline">
                      {r.name}
                    </Link>
                    {myEntryId && r.entryId === myEntryId && (
                      <span className="ml-1.5 text-xs font-semibold text-accent">You</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.roi != null ? `${r.roi > 0 ? "+" : ""}${r.roi.toFixed(1)}%` : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right tabular-nums",
                      r.unitsNet > 0 ? "text-accent" : r.unitsNet < 0 ? "text-danger" : ""
                    )}
                  >
                    {r.unitsNet > 0 ? "+" : ""}
                    {r.unitsNet}u
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.record}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.qualifiedLabel}</td>
                  {showPrize && (
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gold">
                      {r.prizeCents > 0 ? formatCents(r.prizeCents) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {window === "overall" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3 text-accent" /> up
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowDown className="h-3 w-3 text-danger" /> down
          </span>
          <span>vs. yesterday&apos;s standing.</span>
        </p>
      )}

      {window !== "overall" && (
        <p className="mt-3 text-xs text-muted">
          {hasRankedRows
            ? "Ranked by ROI over picks played in this window. No minimum-pick floor and no prize — the money standing is the Overall tab."
            : "No graded picks in this window yet."}
        </p>
      )}
    </div>
  );
}

// Rank-movement indicator vs. the start of today: green ▲ when the entrant
// climbed, red ▼ when they slipped, a muted dash when unchanged, and "NEW" when
// they weren't ranked yesterday.
function RankMove({ rank, previousRank }: { rank: number; previousRank?: number | null }) {
  if (previousRank == null) {
    return <span className="rounded bg-surface-raised px-1 text-[10px] font-semibold text-muted">NEW</span>;
  }
  const delta = previousRank - rank; // >0 means moved up the board
  if (delta === 0) {
    return <Minus className="h-3 w-3 text-muted" aria-label="No change" />;
  }
  if (delta > 0) {
    return (
      <span className="inline-flex items-center text-accent" title={`Up ${delta} from #${previousRank}`}>
        <ArrowUp className="h-3 w-3" />
        <span className="text-[10px] font-semibold tabular-nums">{delta}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-danger" title={`Down ${-delta} from #${previousRank}`}>
      <ArrowDown className="h-3 w-3" />
      <span className="text-[10px] font-semibold tabular-nums">{-delta}</span>
    </span>
  );
}
