import Link from "next/link";
import type { Metadata } from "next";
import {
  Crown,
  Medal,
  Coins,
  Percent,
  TrendingUp,
  Flame,
  History,
  ListChecks,
  CalendarRange,
  Infinity,
  type LucideIcon,
} from "lucide-react";
import {
  listHandicapperSummaries,
  listHandicapperSummariesInWindow,
  type HandicapperSummary,
} from "@/lib/handicappers";
import { Avatar } from "@/components/avatar";
import { SportFilterSelect } from "@/components/sport-filter-select";
import { PlanBadge } from "@/components/plan-badge";
import { formatStreak } from "@/lib/analytics";
import { SPORT_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { siteUrl } from "@/lib/site";
import { ShareButtons } from "@/components/share-buttons";
import { MonthlyPrizeBoard } from "@/components/monthly-prize-board";
import {
  PRIZE_POOL_CENTS,
  boardMonth,
  monthlyStandings,
  prizePhase,
  startsOnLabel,
} from "@/lib/monthly-prizes";
import { formatCents } from "@/lib/utils";
import {
  PERIODS,
  isPeriodKey,
  periodLabel,
  periodWindow,
  type PeriodKey,
} from "@/lib/leaderboard-periods";
import type { PickSport } from "@prisma/client";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "$800 in cash prizes every month for the best verified handicappers. The Blitz.tips leaderboard ranks them by net units, ROI, win rate, and current streak across the NFL, NBA, MLB, NHL, and soccer.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Handicapper Leaderboard — $800 monthly prizes — Blitz.tips",
    description:
      "$500, $200 and $100 every month to the handicappers with the best settled record. Verified, unedited, ranked.",
    url: "/leaderboard",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handicapper Leaderboard — $800 monthly prizes — Blitz.tips",
    description:
      "$500, $200 and $100 every month to the handicappers with the best settled record. Verified, unedited, ranked.",
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
  units: { label: "Net units", Icon: Coins, iconClass: "text-accent", value: (h) => h.stats.unitsNet },
  winRate: { label: "Win rate", Icon: Percent, iconClass: "text-sky-500", value: (h) => h.stats.winRate ?? -Infinity },
  roi: { label: "ROI", Icon: TrendingUp, iconClass: "text-teal-500", value: (h) => h.stats.roi ?? -Infinity },
  streak: { label: "Streak", Icon: Flame, iconClass: "text-orange-500", value: (h) => h.currentStreak },
  l10: { label: "L10", Icon: History, iconClass: "text-violet-500", value: (h) => h.last10Stats.unitsNet },
  picks: { label: "Picks made", Icon: ListChecks, iconClass: "text-muted", value: (h) => h.stats.totalPicks },
  // The plan tiers are filters, not the headline. They live at the end of the
  // row because a visitor arriving at a leaderboard wants the leaderboard —
  // opening on "Gold" showed a paid subset and read as a ranking of everyone.
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
};

const VIEW_KEYS = Object.keys(VIEWS);
// Everyone, best net units first. Net units rather than ROI for the same
// reason the monthly prize uses it: ROI rewards a tiny lucky sample.
const DEFAULT_VIEW = "units";

export default async function LeaderboardPage({
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

  /** Every filter link carries the other two, so choosing one never clears them. */
  const hrefFor = (next: { sort?: string; sport?: string | null; period?: PeriodKey }) => {
    const q = new URLSearchParams();
    const sort = next.sort ?? viewKey;
    const sp = next.sport === undefined ? sportFilter : next.sport;
    const pe = next.period ?? period;
    if (sort !== DEFAULT_VIEW) q.set("sort", sort);
    if (sp) q.set("sport", sp);
    if (pe !== "all") q.set("period", pe);
    const qs = q.toString();
    return `/leaderboard${qs ? `?${qs}` : ""}`;
  };

  // The prize race is its own query — a month's settled picks, not the
  // all-time figures the table below is built from. Before the first month
  // opens there is nothing to rank, so the query is skipped entirely.
  const phase = prizePhase();
  const month = boardMonth();
  const [handicappers, standings] = await Promise.all([
    window
      ? listHandicapperSummariesInWindow(window.start, window.end)
      : listHandicapperSummaries(),
    phase === "live" ? monthlyStandings(month) : Promise.resolve([]),
  ]);

  let list = sportFilter ? handicappers.filter((h) => h.sports.includes(sportFilter)) : handicappers;
  // A leaderboard ranks records, and no record is not a good one. Without this
  // the all-time board put every profile that had never settled a pick at
  // +0.00 — above everyone actually down units, which is both wrong and a
  // standing insult to the cappers who posted and got graded. The period views
  // drop them at the query, so this only has to cover all time.
  list = list.filter((h) => h.stats.wins + h.stats.losses + h.stats.pushes > 0);
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
          <h1 className="text-3xl font-bold">
            Leaderboard{" "}
            <span className="whitespace-nowrap text-gold">
              — {formatCents(PRIZE_POOL_CENTS)}/month
            </span>
          </h1>
          <p className="mt-2 text-muted">
            {period === "all"
              ? "Every verified handicapper, ranked by their full, unedited pick history."
              : `Ranked on picks settled in ${periodLabel(period).toLowerCase()} — ${
                  period === "7d" || period === "30d" ? "a rolling window" : "calendar month"
                }.`}{" "}
            {phase === "upcoming"
              ? `From ${startsOnLabel()}, the top three by net units each month win ${formatCents(PRIZE_POOL_CENTS)} between them.`
              : `Every month the top three by net units win ${formatCents(PRIZE_POOL_CENTS)} between them.`}
          </p>
        </div>
        <ShareButtons
          url={`${siteUrl()}/leaderboard`}
          text={`The sharpest verified sports handicappers on Blitz.tips, ranked by net units, ROI and win rate — and ${formatCents(PRIZE_POOL_CENTS)} in prizes every month 📈`}
        />
      </div>

      <div className="mb-8">
        <MonthlyPrizeBoard month={month} standings={standings} phase={phase} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {VIEW_KEYS.map((key) => {
          const v = VIEWS[key];
          const active = key === viewKey;
          return (
            <Link
              key={key}
              href={hrefFor({ sort: key })}
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
      </div>

      {/* Period on its own row: it answers a different question from the metric
          pills above it, and reading them as one list suggested they were
          alternatives rather than combinable. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">Period</span>
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <Link
              key={p.key}
              href={hrefFor({ period: p.key })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              {p.key === "all" ? <Infinity className="h-4 w-4" /> : <CalendarRange className="h-4 w-4" />}
              {p.label}
            </Link>
          );
        })}
        <SportFilterSelect
          basePath="/leaderboard"
          sort={viewKey}
          sport={sportFilter}
          period={period === "all" ? undefined : period}
        />
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
          <p className="p-8 text-center text-muted">
            {period === "all"
              ? "No handicappers match this filter yet."
              : `Nobody has a settled pick in ${periodLabel(period).toLowerCase()} matching this filter.`}
          </p>
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
                  fallback="logo"
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
