import type { Metadata } from "next";
import Link from "next/link";
import { listHandicapperSummaries, sortPaidFirst, type HandicapperSummary } from "@/lib/handicappers";
import { HandicapperCard } from "@/components/handicapper-card";
import { SportFilterSelect } from "@/components/sport-filter-select";
import { SPORT_LABELS, cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

export const metadata: Metadata = { title: "Handicappers" };
export const dynamic = "force-dynamic";

const SORTS = {
  units: { label: "Net units", fn: (h: HandicapperSummary) => h.stats.unitsNet },
  winRate: { label: "Win rate", fn: (h: HandicapperSummary) => h.stats.winRate ?? -Infinity },
  roi: { label: "ROI", fn: (h: HandicapperSummary) => h.stats.roi ?? -Infinity },
  price: { label: "Price (low to high)", fn: (h: HandicapperSummary) => -h.monthlyPriceCents },
} as const;

type SortKey = keyof typeof SORTS;

export default async function HandicappersPage({
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

  // Paid-plan handicappers always lead the directory — placement is part of
  // what the Silver/Gold plans buy — with the chosen sort applied within tiers.
  const sorted = sortPaidFirst(filtered, (a, b) => SORTS[sortKey].fn(b) - SORTS[sortKey].fn(a));

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Handicappers</h1>
      <p className="mt-2 text-muted">Browse every capper on Blitz.tips and their public track record.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <Link
            key={key}
            href={`/handicappers?sort=${key}${sportFilter ? `&sport=${sportFilter}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              sortKey === key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {SORTS[key].label}
          </Link>
        ))}
        <SportFilterSelect basePath="/handicappers" sort={sortKey} sport={sportFilter} />
      </div>

      {sorted.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">
          No handicappers match this filter yet.
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((h) => (
            <HandicapperCard key={h.id} handicapper={h} />
          ))}
        </div>
      )}
    </div>
  );
}
