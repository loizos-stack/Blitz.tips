"use client";

import { useMemo, useState } from "react";
import { computeStats, unitProfit } from "@/lib/odds";
import { CONTEST_WINDOWS, filterPicksByWindow, type ContestWindowKey } from "@/lib/contest-windows";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { ResultPill } from "@/components/result-pill";
import { LocalTime } from "@/components/local-time";

export interface DetailPick {
  id: string;
  sport: string;
  matchup: string;
  selection: string;
  odds: number;
  units: number;
  result: "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";
  eventStartsAt: string;
}

export function EntrantDetail({ picks }: { picks: DetailPick[] }) {
  const [window, setWindow] = useState<ContestWindowKey>("overall");

  const { stats, pending, graded } = useMemo(() => {
    const inWindow = filterPicksByWindow(picks, window);
    const s = computeStats(inWindow);
    const sorted = [...inWindow].sort(
      (a, b) => new Date(b.eventStartsAt).getTime() - new Date(a.eventStartsAt).getTime()
    );
    return {
      stats: s,
      pending: sorted.filter((p) => p.result === "PENDING"),
      graded: sorted.filter((p) => p.result !== "PENDING"),
    };
  }, [picks, window]);

  const settled = stats.wins + stats.losses + stats.pushes;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1.5">
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

      {/* Stat tiles for the selected window */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="ROI"
          value={stats.roi != null ? `${stats.roi > 0 ? "+" : ""}${stats.roi.toFixed(1)}%` : "—"}
          tone={stats.roi != null ? (stats.roi > 0 ? "pos" : stats.roi < 0 ? "neg" : undefined) : undefined}
        />
        <Tile label="Record" value={stats.record} />
        <Tile
          label="Units"
          value={`${stats.unitsNet > 0 ? "+" : ""}${stats.unitsNet}u`}
          tone={stats.unitsNet > 0 ? "pos" : stats.unitsNet < 0 ? "neg" : undefined}
        />
        <Tile label="Win %" value={stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : "—"} />
        <Tile label="Graded" value={String(settled)} />
        <Tile label="Pending" value={String(stats.pending)} />
      </div>

      {/* Pending + graded pick lists */}
      <div className="card p-0">
        <p className="px-5 pt-5 font-semibold">
          Picks ({pending.length + graded.length})
          {window !== "overall" && <span className="ml-1.5 text-xs font-normal text-muted">in this window</span>}
        </p>
        {pending.length + graded.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No picks in this window.</p>
        ) : (
          <div className="mt-3">
            {pending.length > 0 && <PickGroup title={`Pending (${pending.length})`} picks={pending} />}
            {graded.length > 0 && <PickGroup title={`Graded (${graded.length})`} picks={graded} showProfit />}
          </div>
        )}
      </div>
    </div>
  );
}

function PickGroup({ title, picks, showProfit }: { title: string; picks: DetailPick[]; showProfit?: boolean }) {
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
                  <LocalTime iso={p.eventStartsAt} />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {profit != null && (
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      profit > 0 ? "text-accent" : profit < 0 ? "text-danger" : "text-muted"
                    )}
                  >
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

function Tile({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-accent" : tone === "neg" ? "text-danger" : "";
  return (
    <div className="card p-4">
      <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}
