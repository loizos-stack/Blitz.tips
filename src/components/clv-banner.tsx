import { TrendingUp } from "lucide-react";
import { summarizeClv, MIN_CLV_SAMPLE } from "@/lib/clv";

/**
 * The closing-line-value claim, given its own strip rather than a slot in the
 * stats grid.
 *
 * A win rate can be produced by cherry-picking which results you show, and a
 * good ROI can be produced by a heater. Beating the close over a sample can be
 * produced by neither — the closing price isn't the capper's to choose. On a
 * site whose entire proposition is verified records, that makes this the
 * strongest sentence on the page, and it shouldn't be the sixth tile in a row
 * of six.
 *
 * Renders nothing below MIN_CLV_SAMPLE measured picks. A "100% beat the close"
 * badge off three picks would discredit every honest number next to it.
 */
export function ClvBanner({ picks }: { picks: { odds: number; closingOdds: number | null }[] }) {
  const clv = summarizeClv(picks);
  if (clv.measured < MIN_CLV_SAMPLE || clv.beatRate === null || clv.averageClv === null) return null;

  const positive = clv.averageClv > 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border p-4 ${
        positive ? "border-accent/40 bg-accent/[0.07]" : "border-border bg-surface-raised"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          positive ? "bg-accent/15 text-accent" : "bg-surface text-muted"
        }`}
      >
        <TrendingUp className="h-5 w-5" />
      </span>

      <div className="min-w-0">
        <p className="text-sm font-semibold">
          Beats the closing line{" "}
          <span className={positive ? "text-accent" : undefined}>{clv.beatRate.toFixed(0)}%</span> of
          the time
        </p>
        <p className="text-xs text-muted">
          {clv.averageClv > 0 ? "+" : ""}
          {clv.averageClv.toFixed(2)}% average CLV across {clv.measured} measured picks
        </p>
      </div>

      <p className="max-w-md text-xs text-muted">
        The closing line is the market&apos;s final price. Taking a better number than it is the
        clearest evidence of an edge that exists — win or lose.
      </p>
    </div>
  );
}
