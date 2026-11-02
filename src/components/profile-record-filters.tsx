import Link from "next/link";
import { SportIcon } from "@/components/sport-icon";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { PERIODS, type PeriodKey } from "@/lib/stat-periods";
import type { PickSport } from "@prisma/client";

/**
 * Sport and period filters over one handicapper's record.
 *
 * Links rather than a client component: each combination is a real URL, so a
 * reader can send someone "their NBA record over the last 30 days" and have it
 * open on that view. The page is already force-dynamic, so there is nothing to
 * gain from doing it in the browser.
 *
 * The sport row only lists sports this handicapper actually posts, which comes
 * from their picks rather than a profile field — a chip that filters to an
 * empty record is worse than no chip.
 */
export function ProfileRecordFilters({
  basePath,
  sports,
  sport,
  period,
}: {
  basePath: string;
  sports: PickSport[];
  sport?: PickSport;
  period: PeriodKey;
}) {
  const href = (next: { sport?: PickSport | null; period?: PeriodKey }) => {
    const s = next.sport === undefined ? sport : (next.sport ?? undefined);
    const p = next.period ?? period;
    const q = new URLSearchParams();
    if (s) q.set("sport", s);
    if (p !== "all") q.set("period", p);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const pill = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
      active
        ? "border-accent bg-accent/10 text-accent"
        : "border-border text-muted hover:text-foreground"
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link key={p.key} href={href({ period: p.key })} className={pill(p.key === period)}>
            {p.short}
          </Link>
        ))}
      </div>

      {sports.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href({ sport: null })} className={pill(!sport)}>
            All sports
          </Link>
          {sports.map((s) => (
            <Link key={s} href={href({ sport: s })} className={pill(s === sport)}>
              <SportIcon sport={s} className="h-3.5 w-3.5" />
              {SPORT_LABELS[s] ?? s}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
