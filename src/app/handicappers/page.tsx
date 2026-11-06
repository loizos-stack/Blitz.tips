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
import {
  listHandicapperSummaries,
  listHandicapperSummariesInWindow,
  type HandicapperSummary,
} from "@/lib/handicappers";
import { PERIODS, isPeriodKey, periodLabel, periodWindow, type PeriodKey } from "@/lib/stat-periods";
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
// Net units, not Gold.
//
// Opening on a plan tier meant the first thing a visitor saw was who had paid
// for a plan, on the page whose entire promise is comparing records. Gold and
// Silver are still here as filters, one click away, which is where a tier
// belongs on a page about performance.
const DEFAULT_VIEW = "units";

export default async function HandicappersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; sport?: string; period?: string }>;
}) {
  const params = await searchParams;
  const viewKey = params.sort && params.sort in VIEWS ? params.sort : DEFAULT_VIEW;
  const view = VIEWS[viewKey];
  const sportFilter =
    params.sport && params.sport in SPORT_LABELS ? (params.sport as PickSport) : undefined;
  const period: PeriodKey = isPeriodKey(params.period) ? params.period : "all";
  const window = periodWindow(period);

  // A window re-reads the figures from the picks settled inside it, so every
  // metric on the card — units, ROI, win rate, streak — describes that window
  // rather than a career with a date range written over the top of it.
  const handicappers = window
    ? await listHandicapperSummariesInWindow(window.start, window.end)
    : await listHandicapperSummaries();

  let list = sportFilter ? handicappers.filter((h) => h.sports.includes(sportFilter)) : handicappers;
  if (view.filter) list = list.filter(view.filter);

  // Settled picks behind the figure. The windowed queries only return people
  // who settled something inside the window, so this is really about all time.
  const settled = (h: HandicapperSummary) => h.stats.wins + h.stats.losses + h.stats.pushes;

  // Rank strictly by the active view's metric — no paid-first pinning — but a
  // profile with no record at all goes last whatever the metric says. At +0.00
  // units an ungraded profile outranks everyone who is down on the month, and
  // reading that as "better" is exactly the wrong conclusion. They stay on the
  // page, because browsing is also how a new capper gets found.
  const sorted = [...list].sort((a, b) => {
    const aHas = settled(a) > 0;
    const bHas = settled(b) > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return view.value(b) - view.value(a);
  });

  const href = (next: { sort?: string; sport?: PickSport | null; period?: PeriodKey }) => {
    const q = new URLSearchParams();
    const sort = next.sort ?? viewKey;
    const sp = next.sport === undefined ? sportFilter : (next.sport ?? undefined);
    const pd = next.period ?? period;
    if (sort !== DEFAULT_VIEW) q.set("sort", sort);
    if (sp) q.set("sport", sp);
    if (pd !== "all") q.set("period", pd);
    const qs = q.toString();
    return qs ? `/handicappers?${qs}` : "/handicappers";
  };

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Handicappers</h1>
      <p className="mt-2 text-muted">
        {period === "all"
          ? "Browse every capper on Blitz.tips and their public track record."
          : `Ranked on picks settled in ${periodLabel(period).toLowerCase()}. Short windows are small samples — the record on each card is the whole of it.`}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={href({ period: p.key })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
              p.key === period
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {p.short}
          </Link>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {VIEW_KEYS.map((key) => {
          const v = VIEWS[key];
          const active = key === viewKey;
          return (
            <Link
              key={key}
              href={href({ sort: key })}
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
        <SportFilterSelect
          basePath="/handicappers"
          sort={viewKey}
          sport={sportFilter}
          period={period === "all" ? undefined : period}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">
          {period === "all"
            ? "No handicappers match this filter yet."
            : `Nobody settled a pick in ${periodLabel(period).toLowerCase()}${
                sportFilter ? ` in ${SPORT_LABELS[sportFilter] ?? sportFilter}` : ""
              }. Try a longer window.`}
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
