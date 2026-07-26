import { formatUnits, type LabeledBreakdown } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// A compact record-by-category table (per sport, per bet type, per handicapper…).
export function BreakdownTable({
  rows,
  firstColumn,
  emptyLabel = "No settled picks yet.",
}: {
  rows: LabeledBreakdown[];
  firstColumn: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">{firstColumn}</th>
            <th className="px-4 py-3 text-right">Record</th>
            <th className="px-4 py-3 text-right">Win %</th>
            <th className="px-4 py-3 text-right">Units</th>
            <th className="px-4 py-3 text-right">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2.5 font-medium">{row.label}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.stats.record}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                {row.stats.winRate != null ? `${row.stats.winRate.toFixed(0)}%` : "—"}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-medium tabular-nums",
                  row.stats.unitsNet > 0 && "text-accent",
                  row.stats.unitsNet < 0 && "text-danger"
                )}
              >
                {formatUnits(row.stats.unitsNet)}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right tabular-nums text-muted",
                  row.stats.roi != null && row.stats.roi > 0 && "text-accent",
                  row.stats.roi != null && row.stats.roi < 0 && "text-danger"
                )}
              >
                {row.stats.roi != null ? `${row.stats.roi > 0 ? "+" : ""}${row.stats.roi.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
