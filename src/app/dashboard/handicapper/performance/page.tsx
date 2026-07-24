import { redirect } from "next/navigation";
import { computeStats } from "@/lib/odds";
import { breakdownBy, computeStreaks, cumulativeUnits, formatUnits, pickDate } from "@/lib/analytics";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";
import { UnitsChart } from "@/components/dashboard/units-chart";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import { PerformanceWindows } from "@/components/dashboard/performance-windows";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPerformancePage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const stats = computeStats(handicapper.picks);
  const streaks = computeStreaks(handicapper.picks);
  const unitsSeries = cumulativeUnits(handicapper.picks);

  const bySport = breakdownBy(
    handicapper.picks,
    (p) => p.sport,
    (k) => SPORT_LABELS[k] ?? k
  );
  const byBetType = breakdownBy(
    handicapper.picks,
    (p) => p.betType,
    (k) => BET_TYPE_LABELS[k] ?? k
  );

  // Windows resolve in the browser's timezone, so hand the client just what a
  // record needs plus each pick's timeline date.
  const windowPicks = handicapper.picks.map((p) => ({
    odds: p.odds,
    units: p.units,
    result: p.result,
    date: pickDate(p).toISOString(),
  }));

  const unitsClass =
    stats.unitsNet > 0
      ? "text-accent"
      : stats.unitsNet < 0
        ? "text-danger"
        : "text-muted";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Units over time</p>
            <span className={`text-sm font-semibold ${unitsClass}`}>{formatUnits(stats.unitsNet)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">Cumulative profit/loss across your settled picks.</p>
          <UnitsChart points={unitsSeries} className="mt-4" />
        </div>

        <div className="card p-5">
          <p className="font-semibold">All-time record</p>
          <p className="mt-1 text-xs text-muted">Every settled pick you&apos;ve posted.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums">{stats.record}</p>
              <p className="text-xs text-muted">Record</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : "—"}
              </p>
              <p className="text-xs text-muted">Win rate</p>
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums ${unitsClass}`}>{formatUnits(stats.unitsNet)}</p>
              <p className="text-xs text-muted">Units</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats.roi != null ? `${stats.roi > 0 ? "+" : ""}${stats.roi.toFixed(0)}%` : "—"}
              </p>
              <p className="text-xs text-muted">ROI</p>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted">
            Best win streak <span className="font-semibold text-foreground">{streaks.bestWin || "—"}</span>
            {"  ·  "}
            Longest losing streak{" "}
            <span className="font-semibold text-foreground">{streaks.worstLoss || "—"}</span>
          </div>
        </div>
      </div>

      <div className="card p-0">
        <p className="px-5 pt-5 font-semibold">By period</p>
        <p className="px-5 pb-1 pt-1 text-xs text-muted">
          Today, yesterday, and rolling windows — in your local time.
        </p>
        <div className="mt-2">
          <PerformanceWindows picks={windowPicks} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-0">
          <p className="px-5 pt-5 font-semibold">By sport</p>
          <div className="mt-3">
            <BreakdownTable rows={bySport} firstColumn="Sport" />
          </div>
        </div>
        <div className="card p-0">
          <p className="px-5 pt-5 font-semibold">By bet type</p>
          <div className="mt-3">
            <BreakdownTable rows={byBetType} firstColumn="Bet type" />
          </div>
        </div>
      </div>
    </div>
  );
}
