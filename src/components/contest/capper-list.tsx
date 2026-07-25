import Link from "next/link";
import { formatCents } from "@/lib/utils";

/**
 * The compact "here's who's worth paying for" list. Shared by every contest
 * surface that points an entrant at the marketplace (dashboard, entrant page)
 * so the pitch reads identically wherever it shows up.
 */
export interface CapperRow {
  handle: string;
  displayName: string;
  record: string;
  unitsNet: number;
  roi: number | null;
  monthlyPriceCents: number | null;
}

export function CapperList({ cappers }: { cappers: CapperRow[] }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {cappers.map((h) => (
        <Link
          key={h.handle}
          href={`/handicappers/${h.handle}`}
          className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent"
        >
          {/* The name is what's being sold, so it holds its width (capped, so a
              very long one can't push the row) and the record ellipsizes first.
              Both stay on one line — this list renders in narrow sidebars. */}
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="max-w-[60%] shrink-0 truncate font-medium">{h.displayName}</span>
            <span className="truncate text-xs text-muted">
              {h.record} · {h.unitsNet > 0 ? "+" : ""}
              {h.unitsNet}u
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="font-semibold tabular-nums text-accent">
              {h.roi != null ? `${h.roi > 0 ? "+" : ""}${h.roi.toFixed(1)}%` : "—"}
            </span>
            {h.monthlyPriceCents ? (
              <span className="ml-2 text-xs text-muted">{formatCents(h.monthlyPriceCents)}/mo</span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  );
}
