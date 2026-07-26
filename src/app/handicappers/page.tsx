import type { Metadata } from "next";
import Link from "next/link";
import {
  Crown,
  Medal,
  Coins,
  Percent,
  TrendingUp,
  Flame,
  History,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  type LucideIcon,
} from "lucide-react";
import { listHandicapperSummaries, type HandicapperSummary } from "@/lib/handicappers";
import { HandicapperCard } from "@/components/handicapper-card";
import { SportFilterSelect } from "@/components/sport-filter-select";
import { SPORT_LABELS, cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

export const metadata: Metadata = {
  title: "Handicappers",
  description:
    "Browse every verified handicapper on Blitz.tips. Compare records, units, ROI, reviews, and prices, then subscribe to the cappers who consistently beat the market.",
  alternates: { canonical: "/handicappers" },
  openGraph: {
    title: "Browse Handicappers — Blitz.tips",
    description: "Compare verified records, units, ROI, reviews, and prices across every handicapper.",
    url: "/handicappers",
  },
};
export const dynamic = "force-dynamic";

// Directory "views" — one active at a time, mirroring the leaderboard. `gold`
// and `silver` restrict to that plan tier (ranked by net units); the rest rank
// everyone by the chosen metric. No view pins paid plans first — every card is
// at its true rank for the active view.
type View = {
  label: string;
  Icon: LucideIcon;
  iconClass: string;
  value: (h: HandicapperSummary) => number;
  filter?: (h: HandicapperSummary) => boolean;
};

const VIEWS: Record<string, View> = {
  gold: {
    label: "Gold",
    Icon: Crown,
    iconClass: "text-yellow-500",
    value: (h) => h.stats.unitsNet,
    filter: (h) => h.plan === "GOLD" && h.planStatus === "ACTIVE",
  },
  silver: {
    label: "Silver",
    Icon: Medal,
    iconClass: "text-zinc-400",
    value: (h) => h.stats.unitsNet,
    filter: (h) => h.plan === "SILVER" && h.planStatus === "ACTIVE",
  },
  units: { label: "Net units", Icon: Coins, iconClass: "text-accent", value: (h) => h.stats.unitsNet },
  winRate: { label: "Win rate", Icon: Percent, iconClass: "text-sky-500", value: (h) => h.stats.winRate ?? -Infinity },
  roi: { label: "ROI", Icon: TrendingUp, iconClass: "text-teal-500", value: (h) => h.stats.roi ?? -Infinity },
  streak: { label: "Streak", Icon: Flame, iconClass: "text-orange-500", value: (h) => h.currentStreak },
  l10: { label: "L10", Icon: History, iconClass: "text-violet-500", value: (h) => h.last10Stats.unitsNet },
  priceLow: {
    label: "Price: low to high",
    Icon: ArrowUpNarrowWide,
    iconClass: "text-emerald-500",
    value: (h) => -h.monthlyPriceCents,
  },
  priceHigh: {
    label: "Price: high to low",
    Icon: ArrowDownWideNarrow,
    iconClass: "text-rose-500",
    value: (h) => h.monthlyPriceCents,
  },
};

const VIEW_KEYS = Object.keys(VIEWS);
const DEFAULT_VIEW = "gold";

export default async function HandicappersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; sport?: string }>;
}) {
  const params = await searchParams;
  const viewKey = params.sort && params.sort in VIEWS ? params.sort : DEFAULT_VIEW;
  const view = VIEWS[viewKey];
  const sportFilter =
    params.sport && params.sport in SPORT_LABELS ? (params.sport as PickSport) : undefined;

  const handicappers = await listHandicapperSummaries();

  let list = sportFilter ? handicappers.filter((h) => h.sports.includes(sportFilter)) : handicappers;
  if (view.filter) list = list.filter(view.filter);

  // Rank strictly by the active view's metric — no paid-first pinning.
  const sorted = [...list].sort((a, b) => view.value(b) - view.value(a));

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Handicappers</h1>
      <p className="mt-2 text-muted">Browse every capper on Blitz.tips and their public track record.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {VIEW_KEYS.map((key) => {
          const v = VIEWS[key];
          const active = key === viewKey;
          return (
            <Link
              key={key}
              href={`/handicappers?sort=${key}${sportFilter ? `&sport=${sportFilter}` : ""}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
                active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
              )}
            >
              <v.Icon className={cn("h-4 w-4", v.iconClass)} />
              {v.label}
            </Link>
          );
        })}
        <SportFilterSelect basePath="/handicappers" sort={viewKey} sport={sportFilter} />
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
