import { redirect } from "next/navigation";
import { computeStats } from "@/lib/odds";
import { computeStreaks, cumulativeUnits, formatUnits, statsSince } from "@/lib/analytics";
import { UnitsChart } from "@/components/dashboard/units-chart";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperPerformancePage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) redirect("/dashboard/handicapper");

  const stats = computeStats(handicapper.picks);
  const streaks = computeStreaks(handicapper.picks);
  const unitsSeries = cumulativeUnits(handicapper.picks);
  const last30 = statsSince(handicapper.picks, 30);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Units over time</p>
          <span
            className={
              stats.unitsNet > 0
                ? "text-sm font-semibold text-accent"
                : stats.unitsNet < 0
                  ? "text-sm font-semibold text-danger"
                  : "text-sm font-semibold text-muted"
            }
          >
            {formatUnits(stats.unitsNet)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">Cumulative profit/loss across your settled picks.</p>
        <UnitsChart points={unitsSeries} className="mt-4" />
      </div>

      <div className="card p-5">
        <p className="font-semibold">Last 30 days</p>
        <p className="mt-1 text-xs text-muted">Rolling form from recently settled picks.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums">{last30.record}</p>
            <p className="text-xs text-muted">Record</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {last30.winRate != null ? `${last30.winRate.toFixed(0)}%` : "—"}
            </p>
            <p className="text-xs text-muted">Win rate</p>
          </div>
          <div>
            <p
              className={
                last30.unitsNet > 0
                  ? "text-2xl font-bold tabular-nums text-accent"
                  : last30.unitsNet < 0
                    ? "text-2xl font-bold tabular-nums text-danger"
                    : "text-2xl font-bold tabular-nums"
              }
            >
              {formatUnits(last30.unitsNet)}
            </p>
            <p className="text-xs text-muted">Units</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {last30.roi != null ? `${last30.roi > 0 ? "+" : ""}${last30.roi.toFixed(0)}%` : "—"}
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
  );
}
