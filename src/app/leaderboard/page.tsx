import Link from "next/link";
import type { Metadata } from "next";
import { Crown, Medal, Coins, Percent, TrendingUp, Flame, History, ListChecks, type LucideIcon } from "lucide-react";
import { listHandicapperSummaries, type HandicapperSummary } from "@/lib/handicappers";
import { Avatar } from "@/components/avatar";
import { SportFilterSelect } from "@/components/sport-filter-select";
import { PlanBadge } from "@/components/plan-badge";
import { formatStreak } from "@/lib/analytics";
import { SPORT_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { siteUrl } from "@/lib/site";
import { ShareButtons } from "@/components/share-buttons";
import type { PickSport } from "@prisma/client";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "The Blitz.tips leaderboard ranks verified sports handicappers by net units, ROI, win rate, and current streak. Find the sharpest cappers across the NFL, NBA, MLB, NHL, and soccer.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Handicapper Leaderboard — Blitz.tips",
    description: "Verified handicappers ranked by net units, ROI, win rate, and streak.",
    url: "/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handicapper Leaderboard — Blitz.tips",
    description: "Verified handicappers ranked by net units, ROI, win rate, and streak.",
  },
};
export const dynamic = "force-dynamic";

// Leaderboard "views" — one active at a time. `gold` and `silver` restrict the
// population to that plan tier (ranked by net units); the rest rank everyone by
// the chosen metric. No view pins featured cappers first — every row is at its
// true rank for the active view.
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
  picks: { label: "Picks made", Icon: ListChecks, iconClass: "text-muted", value: (h) => h.stats.totalPicks },
};

const VIEW_KEYS = Object.keys(VIEWS);
const DEFAULT_VIEW = "gold";

export default async function LeaderboardPage({
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

  // Rank strictly by the active view's metric — no featured-first pinning.
  const sorted = [...list].sort((a, b) => view.value(b) - view.value(a));

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/auth-bg.svg')] bg-cover bg-center"
      />
      <div className="container-page relative py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="mt-2 text-muted">
            Verified handicappers ranked by their full, unedited pick history. Filter by tier, metric, or sport.
          </p>
        </div>
        <ShareButtons
          url={`${siteUrl()}/leaderboard`}
          text="The sharpest verified sports handicappers on Blitz.tips, ranked by net units, ROI, and win rate 📈"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {VIEW_KEYS.map((key) => {
          const v = VIEWS[key];
          const active = key === viewKey;
          return (
            <Link
              key={key}
              href={`/leaderboard?sort=${key}${sportFilter ? `&sport=${sportFilter}` : ""}`}
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
        <SportFilterSelect basePath="/leaderboard" sort={viewKey} sport={sportFilter} />
      </div>

      <div className="card overflow-hidden">
        <div className="hidden gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted md:grid md:grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] lg:grid-cols-[3rem_1fr_5rem_5rem_5rem_5rem_4.5rem_4.5rem_4.5rem]">
          <span>#</span>
          <span>Handicapper</span>
          <span className="text-right">Record</span>
          <span className="text-right">Win %</span>
          <span className="text-right">Units</span>
          <span className="text-right">ROI</span>
          <span className="hidden text-right lg:block">Streak</span>
          <span className="hidden text-right lg:block">L10</span>
          <span className="hidden text-right lg:block">Picks</span>
        </div>
        {sorted.length === 0 ? (
          <p className="p-8 text-center text-muted">No handicappers match this filter yet.</p>
        ) : (
          sorted.map((h, i) => {
            return (
            <Link
              key={h.id}
              href={`/handicappers/${h.handle}`}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-raised/60 md:grid-cols-[3rem_1fr_6rem_6rem_6rem_6rem] md:gap-4 lg:grid-cols-[3rem_1fr_5rem_5rem_5rem_5rem_4.5rem_4.5rem_4.5rem]"
            >
              <span className="text-sm font-bold text-muted">#{i + 1}</span>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={h.avatarUrl}
                  name={h.displayName}
                  className="h-10 w-10 shrink-0 rounded-full text-sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold">{h.displayName}</p>
                    <PlanBadge plan={h.plan} planStatus={h.planStatus} />
                  </div>
                  <p className="truncate text-sm text-muted">@{h.handle}</p>
                </div>
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
              <span
                className={cn(
                  "hidden text-right font-semibold tabular-nums lg:block",
                  h.currentStreak > 0 ? "text-accent" : h.currentStreak < 0 ? "text-danger" : "text-muted"
                )}
              >
                {formatStreak(h.currentStreak)}
              </span>
              <span className="hidden text-right tabular-nums text-muted lg:block">
                {h.last10Stats.totalPicks > 0 ? h.last10Stats.record : "—"}
              </span>
              <span className="hidden text-right tabular-nums text-muted lg:block">{h.stats.totalPicks}</span>
            </Link>
          );
          })
        )}
      </div>
      </div>
    </div>
  );
}
