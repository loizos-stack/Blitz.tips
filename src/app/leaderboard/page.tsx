import Link from "next/link";
import type { Metadata } from "next";
import { listHandicapperSummaries, sortFeaturedFirst, type HandicapperSummary } from "@/lib/handicappers";
import { SPORT_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

export const metadata: Metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

const SORTS = {
  units: { label: "Net units", fn: (h: HandicapperSummary) => h.stats.unitsNet },
  winRate: { label: "Win rate", fn: (h: HandicapperSummary) => h.stats.winRate ?? -Infinity },
  roi: { label: "ROI", fn: (h: HandicapperSummary) => h.stats.roi ?? -Infinity },
  picks: { label: "Picks made", fn: (h: HandicapperSummary) => h.stats.totalPicks },
} as const;

type SortKey = keyof typeof SORTS;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; sport?: string }>;
}) {
  const params = await searchParams;
  const sortKey: SortKey = (params.sort && params.sort in SORTS ? params.sort : "units") as SortKey;
  const sportFilter =
    params.sport && params.sport in SPORT_LABELS ? (params.sport as PickSport) : undefined;

  const handicappers = await listHandicapperSummaries();

  const filtered = sportFilter
    ? handicappers.filter((h) => h.sports.includes(sportFilter))
    : handicappers;

  const sorted = sortFeaturedFirst(filtered, (a, b) => SORTS[sortKey].fn(b) - SORTS[sortKey].fn(a));

  const sportOptions = ["all", ...Object.keys(SPORT_LABELS)];

  return (
    <div className="container-page py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-muted">
          Every handicapper on Blitz.tips, ranked by their full, unedited pick history.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={`/leaderboard?sort=${key}${sportFilter ? `&sport=${sportFilter}` : ""}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                sortKey === key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
              )}
            >
              {SORTS[key].label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 md:ml-auto">
          {sportOptions.map((sport) => (
            <Link
              key={sport}
              href={`/leaderboard?sort=${sortKey}${sport !== "all" ? `&sport=${sport}` : ""}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                (sportFilter ?? "all") === sport ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground"
              )}
            >
              {sport === "all" ? "All sports" : SPORT_LABELS[sport]}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted md:grid">
          <span>#</span>
          <span>Handicapper</span>
          <span className="text-right">Record</span>
          <span className="text-right">Win %</span>
          <span className="text-right">Units</span>
          <span className="text-right">ROI</span>
        </div>
        {sorted.length === 0 ? (
          <p className="p-8 text-center text-muted">No handicappers match this filter yet.</p>
        ) : (
          sorted.map((h, i) => (
            <Link
              key={h.id}
              href={`/handicappers/${h.handle}`}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-raised/60 md:grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] md:gap-4"
            >
              <span className="text-sm font-bold text-muted">#{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">{h.displayName}</p>
                  {h.isFeatured && (
                    <span className="shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                      FEATURED
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-muted">@{h.handle}</p>
              </div>
              <span className="hidden text-right tabular-nums md:block">{h.stats.record}</span>
              <span className="hidden text-right tabular-nums md:block">
                {h.stats.winRate ? `${h.stats.winRate.toFixed(1)}%` : "—"}
              </span>
              <span
                className={cn(
                  "hidden text-right font-semibold tabular-nums md:block",
                  h.stats.unitsNet >= 0 ? "text-accent" : "text-danger"
                )}
              >
                {h.stats.unitsNet >= 0 ? "+" : ""}
                {h.stats.unitsNet.toFixed(1)}
              </span>
              <span className="hidden text-right tabular-nums text-muted md:block">
                {h.stats.roi !== null ? `${h.stats.roi.toFixed(1)}%` : "—"}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
