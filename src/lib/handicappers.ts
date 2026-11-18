import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeStats, type HandicapperStats } from "@/lib/odds";
import { currentStreakFrom, isDecided, isSettled, pickDate } from "@/lib/analytics";
import { isFeaturedHandicapper } from "@/lib/plans";
import { SPORT_LABELS } from "@/lib/utils";
import type { HandicapperProfile, Pick as PickModel, Review, ParlayLeg, PickSport } from "@prisma/client";

export type PickWithLegs = PickModel & { parlayLegs: ParlayLeg[] };

export type ReviewWithAuthor = Review & {
  author: { id: string; name: string | null; username: string | null; image: string | null };
};

export type HandicapperSummary = HandicapperProfile & {
  stats: HandicapperStats;
  last30Stats: HandicapperStats;
  /** Record over the most recent 10 settled picks (the "L10" form line). */
  last10Stats: HandicapperStats;
  /** Current win/loss run (positive = wins, negative = losses); shown on cards. */
  currentStreak: number;
  isFeatured: boolean;
  /** Number of approved reviews. */
  reviewsCount: number;
  /** Mean approved rating (1 decimal), or null when there are none. */
  reviewsAverage: number | null;
};

/** Gold handicappers are pinned to the top, per their plan's promised placement; ties broken by the given stat. */
export function sortFeaturedFirst<T extends { isFeatured: boolean }>(
  items: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  return [...items].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return compareFn(a, b);
  });
}

/**
 * Paid-plan handicappers (Gold above Silver, active billing only) are pinned
 * above free ones regardless of the chosen sort; ties within each tier break
 * by the given stat comparator. Used on the directory, where placement is
 * part of what paid plans buy.
 */
export function sortPaidFirst<T extends Pick<HandicapperProfile, "plan" | "planStatus">>(
  items: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  const tier = (h: T) =>
    h.planStatus !== "ACTIVE" ? 0 : h.plan === "GOLD" ? 2 : h.plan === "SILVER" ? 1 : 0;
  return [...items].sort((a, b) => tier(b) - tier(a) || compareFn(a, b));
}

const STATS_LOOKBACK_DAYS = 30;

/**
 * The sports a handicapper actually posts in, busiest first.
 *
 * Derived from their picks, never declared. A declared list is a claim, and on
 * a site whose whole pitch is that the record cannot be edited after the fact,
 * a claim is the wrong thing to filter on: someone who ticked NCAAF at signup
 * and never posted an NCAAF tip would still appear under the NCAAF filter,
 * which makes the filter a list of intentions rather than of evidence.
 *
 * Deriving also means it is self-correcting in the direction the old column
 * never was: the previous code added a sport when a pick was posted but had no
 * way to take one away, so a sport posted once and abandoned — or a pick later
 * deleted — stayed on the profile forever.
 *
 * Busiest first so the card, which has room for four, shows what the
 * handicapper is actually known for. Ties break alphabetically, only so the
 * order is stable between renders rather than shifting with row order.
 *
 * Parlays count under the sport on the parlay itself, not its legs. A
 * cross-sport parlay therefore reports only its headline sport — the legs are
 * a separate table and joining it on every directory render costs more than
 * that edge is worth.
 */
export function sportsFromPicks(picks: { sport: PickSport }[]): PickSport[] {
  const counts = new Map<PickSport, number>();
  for (const p of picks) counts.set(p.sport, (counts.get(p.sport) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([aSport, aCount], [bSport, bCount]) => bCount - aCount || aSport.localeCompare(bSport))
    .map(([sport]) => sport);
}

const APPROVED_REVIEW_RATINGS = {
  reviews: { where: { status: "APPROVED" as const }, select: { rating: true } },
} as const;

/**
 * The only pick columns a summary is derived from.
 *
 * `odds`/`units`/`result` feed computeStats, `sport` feeds sportsFromPicks,
 * `createdAt` picks out the 30-day window, and `settledAt`/`eventStartsAt` are
 * what pickDate orders the streak and L10 by. Nothing else is read.
 *
 * Selecting them explicitly rather than taking the whole row matters more than
 * it looks. These queries fetch every pick of every handicapper, and the
 * columns left out are the big ones — `analysis` is free text that can run to
 * paragraphs, and `matchup`/`selection`/`league` are carried on every row too.
 * Pulling them costs database transfer, JSON deserialization and heap on every
 * cache miss, and then costs again on the way into the cache entry, which
 * unstable_cache stringifies whole. None of it is ever read.
 *
 * The directory and the profile page deliberately do NOT use this — they
 * render pick text, so they need the full rows.
 */
const SUMMARY_PICK_COLUMNS = {
  odds: true,
  units: true,
  result: true,
  sport: true,
  createdAt: true,
  settledAt: true,
  eventStartsAt: true,
} as const;

async function loadHandicapperSummaries(): Promise<HandicapperSummary[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: { picks: { select: SUMMARY_PICK_COLUMNS }, ...APPROVED_REVIEW_RATINGS },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.map(toSummary);
}

// Public listing pages (leaderboard, /handicappers) tolerate ~1 min of stat
// staleness, so cache the whole aggregation. This keeps the heavy full-table
// scan + per-pick stat computation off the request path — the main TTFB win.
export const listHandicapperSummaries = unstable_cache(loadHandicapperSummaries, ["handicapper-summaries-v2"], {
  revalidate: 60,
  tags: ["handicappers"],
});

/**
 * Summaries built only from picks settled inside a window, for the
 * leaderboard's period filters.
 *
 * Every figure on the row — record, units, ROI, streak, L10, picks — is then
 * about that window, because toSummary derives all of them from whatever picks
 * it is handed. That is the point: "last 7 days" showing an all-time streak
 * beside a 7-day record would be two different claims in one row.
 *
 * Handicappers with nothing settled in the window are dropped rather than
 * listed at zero. Over a 7-day window most of the roster has no result, and a
 * ranking whose middle is a hundred identical zeroes is not a ranking.
 */
async function loadSummariesInWindow(start: Date, end: Date): Promise<HandicapperSummary[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: {
      picks: {
        where: { settledAt: { gte: start, lt: end }, result: { not: "PENDING" } },
        select: SUMMARY_PICK_COLUMNS,
      },
      ...APPROVED_REVIEW_RATINGS,
    },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.filter((h) => h.picks.length > 0).map(toSummary);
}

// Cached per window like the all-time list. unstable_cache keys on the
// arguments, so each period gets its own entry; a 60s-stale window boundary is
// irrelevant to a 7-day span.
export const listHandicapperSummariesInWindow = unstable_cache(
  loadSummariesInWindow,
  ["handicapper-window-v1"],
  { revalidate: 60, tags: ["handicappers"] }
);

export type DirectoryHandicapper = HandicapperSummary & {
  followersCount: number;
  /** Has posted at least one player-prop pick. */
  hasProps: boolean;
  /** Has posted at least one parlay. */
  hasParlays: boolean;
  /** Lowercased haystack of everything on the profile the finder search matches. */
  searchText: string;
  /**
   * When the most recent pick was posted, as an ISO string — null for a
   * handicapper who has never posted one.
   *
   * A string rather than a Date deliberately. `unstable_cache` persists its
   * value with `JSON.stringify`, so every Date on this object already comes
   * back as a string on a cache hit however it is typed. Declaring the one
   * field callers actually compare as what survives that round trip is the
   * difference between a working comparison and one that silently reads
   * `"2026-10-29T…" >= Date` — true for no good reason.
   */
  lastPickAt: string | null;
};

/**
 * All active handicappers with their follower count, approved-review count, and
 * the flags/haystack the homepage "Find a Handicapper" finder needs to filter
 * (sport, player props, parlays), sort (hot, most followed, most reviewed), and
 * search across everything on the profile.
 */
async function loadHandicapperDirectory(): Promise<DirectoryHandicapper[]> {
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: {
      // No parlayLegs join — a parlay's parent `selection` already concatenates
      // its legs, so the search haystack keeps them without the extra query.
      picks: true,
      ...APPROVED_REVIEW_RATINGS,
      _count: { select: { followers: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return handicappers.map((h) => {
    const searchText = [
      h.displayName,
      h.handle,
      h.bio ?? "",
      ...sportsFromPicks(h.picks).map((s) => SPORT_LABELS[s] ?? s),
      ...h.picks.flatMap((p) => [p.matchup, p.selection, p.league ?? "", p.analysis ?? ""]),
    ]
      .join(" ")
      .toLowerCase();

    // Posting time, not event time: a capper who put up ten picks today for
    // games next Sunday is active, and one whose last post was a month ago is
    // not, whenever those games happen to kick off.
    const lastPostedAt = h.picks.reduce<Date | null>(
      (latest, p) => (latest === null || p.createdAt > latest ? p.createdAt : latest),
      null
    );

    return {
      ...toSummary(h),
      followersCount: h._count.followers,
      hasProps: h.picks.some((p) => p.betType === "PROP"),
      hasParlays: h.picks.some((p) => p.betType === "PARLAY"),
      searchText,
      lastPickAt: lastPostedAt?.toISOString() ?? null,
    };
  });
}

// Cached like the summaries — the homepage finder reads only precomputed fields,
// so a 60s-stale directory is fine and keeps the aggregation off the hot path.
// Bumped with the shape, because a warm entry from the previous version is
// wrong rather than merely stale: v1 had no lastPickAt, and `undefined` reads
// as "never posted", which would hide every handicapper on the homepage; v2
// still carried declared sports, which would show pills for sports nobody has
// posted in. Either would be served for the first minute after a deploy.
export const listHandicapperDirectory = unstable_cache(loadHandicapperDirectory, ["handicapper-directory-v3"], {
  revalidate: 60,
  tags: ["handicappers"],
});

/** A handicapper counts as active if they posted a pick within this many days. */
export const ACTIVE_WITHIN_DAYS = 7;

/**
 * Split the directory into handicappers who have posted recently and ones who
 * have gone quiet. The homepage shows the first group and keeps the second
 * behind a "Load more" button.
 *
 * Never having posted counts as quiet. An empty profile is the least useful
 * card on the page, and it is also exactly what a newly registered capper
 * looks like — so it sits with the dormant ones rather than at the top of the
 * directory.
 *
 * `now` is injectable for tests only.
 */
export function splitByActivity<T extends { lastPickAt: string | null }>(
  list: T[],
  { days = ACTIVE_WITHIN_DAYS, now = Date.now() }: { days?: number; now?: number } = {}
): { active: T[]; dormant: T[] } {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const active: T[] = [];
  const dormant: T[] = [];
  for (const h of list) {
    const posted = h.lastPickAt === null ? NaN : Date.parse(h.lastPickAt);
    // An unparseable timestamp is treated as quiet rather than throwing: a bad
    // value should cost a handicapper a click, not the whole page.
    (Number.isFinite(posted) && posted >= cutoff ? active : dormant).push(h);
  }
  return { active, dormant };
}

// The non-sport quick filters for the homepage finder. Sport keys (NBA, MLB, …)
// are the other valid filter values.
export const FINDER_SORTS = ["all", "hot", "followed", "reviewed"] as const;
export type FinderSort = (typeof FINDER_SORTS)[number];

/**
 * Filter + sort the directory for the homepage finder. `filter` is one of the
 * FINDER_SORTS keys or a PickSport value; `query` matches display name / handle.
 * Featured (gold) cappers stay pinned first only under the default "all" sort —
 * the explicit sorts (hot / most followed / most reviewed) are respected as-is.
 */
export function applyHandicapperFinder(
  list: DirectoryHandicapper[],
  filter: string,
  query: string
): DirectoryHandicapper[] {
  let out = [...list];

  if (filter in SPORT_LABELS) {
    out = out.filter((h) => h.sports.includes(filter as PickSport));
    out.sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "props") {
    out = out.filter((h) => h.hasProps).sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "parlays") {
    out = out.filter((h) => h.hasParlays).sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "gold") {
    // Only GOLD-plan (featured) handicappers, best net units first.
    out = out.filter((h) => h.isFeatured).sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "silver") {
    // Only SILVER-plan (active) handicappers, best net units first.
    out = out
      .filter((h) => h.plan === "SILVER" && h.planStatus === "ACTIVE")
      .sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "hot") {
    out.sort(
      (a, b) => b.currentStreak - a.currentStreak || b.last10Stats.unitsNet - a.last10Stats.unitsNet
    );
  } else if (filter === "followed") {
    out.sort((a, b) => b.followersCount - a.followersCount || b.stats.unitsNet - a.stats.unitsNet);
  } else if (filter === "reviewed") {
    out.sort((a, b) => b.reviewsCount - a.reviewsCount || b.stats.unitsNet - a.stats.unitsNet);
  } else {
    out = sortFeaturedFirst(out, (a, b) => b.stats.unitsNet - a.stats.unitsNet);
  }

  // Search matches everything on the profile (name, @handle, bio, sports, and
  // every pick's matchup / selection / league / analysis / parlay legs).
  const q = query.trim().toLowerCase();
  if (q) out = out.filter((h) => h.searchText.includes(q));
  return out;
}

/** Summaries for a specific set of handicapper ids (e.g. the ones a user follows). */
export async function listHandicapperSummariesByIds(ids: string[]): Promise<HandicapperSummary[]> {
  if (ids.length === 0) return [];
  const handicappers = await prisma.handicapperProfile.findMany({
    where: { id: { in: ids }, suspendedAt: null },
    include: { picks: true, ...APPROVED_REVIEW_RATINGS },
  });
  return handicappers.map(toSummary);
}

async function loadHandicapperByHandle(
  handle: string
): Promise<(HandicapperSummary & { picksList: PickWithLegs[]; reviews: ReviewWithAuthor[] }) | null> {
  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { handle },
    include: {
      picks: {
        orderBy: { eventStartsAt: "desc" },
        include: { parlayLegs: { orderBy: { order: "asc" } } },
      },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, name: true, username: true, image: true } } },
      },
    },
  });

  if (!handicapper) return null;

  return {
    ...toSummary(handicapper),
    picksList: handicapper.picks,
    reviews: handicapper.reviews,
  };
}

/**
 * A profile with everything its page renders, memoised for the request.
 *
 * The profile route loads this twice: once in generateMetadata and once in the
 * component, which in the App Router are two calls in the same request. It is
 * the heaviest query on the site — every pick with its parlay legs, plus every
 * approved review with its author — so doing it twice was doubling the cost of
 * the most-crawled page on the site. Prisma calls are not deduplicated the way
 * fetch is, so this needs saying explicitly.
 *
 * React's `cache` and not `unstable_cache` on purpose: this is per-request
 * memoisation, not a stored entry, so it adds no staleness at all. A
 * handicapper still sees a pick the instant they post it, which a TTL here
 * would have delayed — and on a page whose whole promise is a record you can
 * check, "wait a minute" is the wrong trade for a second query.
 */
export const getHandicapperByHandle = cache(loadHandicapperByHandle);

export type HotHandicapper = HandicapperSummary & {
  /** Stats over picks settled within the lookback window (default last 7 days). */
  weekStats: HandicapperStats;
};

/**
 * The "hottest" handicappers over a recent window, ranked by ROI. Only counts
 * picks settled within the window, and requires a minimum sample so a single
 * lucky settled pick doesn't top the list. Used by the signup discover step.
 */
export async function listHottestHandicappers({
  days = 7,
  limit = 6,
  minSettled = 3,
}: { days?: number; limit?: number; minSettled?: number } = {}): Promise<HotHandicapper[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const handicappers = await prisma.handicapperProfile.findMany({
    where: { suspendedAt: null },
    include: { picks: true, ...APPROVED_REVIEW_RATINGS },
  });

  const ranked = handicappers
    .map((h) => {
      const windowPicks = h.picks.filter((p) => p.settledAt && p.settledAt >= cutoff);
      return { ...toSummary(h), weekStats: computeStats(windowPicks) };
    })
    .filter((h) => h.weekStats.roi !== null && h.weekStats.wins + h.weekStats.losses >= minSettled)
    .sort((a, b) => (b.weekStats.roi ?? 0) - (a.weekStats.roi ?? 0));

  return ranked.slice(0, limit);
}

/**
 * What toSummary needs from a pick — see SUMMARY_PICK_COLUMNS.
 *
 * Declared structurally rather than as the full `PickModel` so the listing
 * queries can select only these seven columns. A caller holding whole pick
 * rows still satisfies it, which is why the directory and profile paths keep
 * working unchanged.
 */
type SummaryPick = Pick<
  PickModel,
  "odds" | "units" | "result" | "sport" | "createdAt" | "settledAt" | "eventStartsAt"
>;

function toSummary(
  handicapper: HandicapperProfile & { picks: SummaryPick[]; reviews?: { rating: number }[] }
): HandicapperSummary {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STATS_LOOKBACK_DAYS);

  const recentPicks = handicapper.picks.filter((p) => p.createdAt >= cutoff);

  // Sorted once and shared. lastNStats and computeStreaks each used to filter
  // and sort the whole pick list themselves, so a summary paid for two full
  // sorts; this pays for one. `decided` reuses that order rather than sorting
  // again, which it can because decided picks are a subset of settled ones and
  // filtering preserves order.
  const settledChronological = handicapper.picks
    .filter((p) => isSettled(p.result))
    .sort((a, b) => pickDate(a).getTime() - pickDate(b).getTime());
  const decidedChronological = settledChronological.filter((p) => isDecided(p.result));

  const ratings = handicapper.reviews ?? [];
  const reviewsCount = ratings.length;
  const reviewsAverage =
    reviewsCount === 0
      ? null
      : Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / reviewsCount) * 10) / 10;

  return {
    ...handicapper,
    // Overrides the profile's stored `sports` column, which is no longer
    // written and no longer means anything. Everything that renders a sport
    // pill or filters by sport reads this object, so this one line is what
    // makes the filters match the record.
    sports: sportsFromPicks(handicapper.picks),
    stats: computeStats(handicapper.picks),
    last30Stats: computeStats(recentPicks),
    // Same results as lastNStats(picks, 10) and computeStreaks(picks).current,
    // off the one shared ordering above.
    last10Stats: computeStats(settledChronological.slice(-10)),
    currentStreak: currentStreakFrom(decidedChronological),
    isFeatured: isFeaturedHandicapper(handicapper.plan, handicapper.planStatus),
    reviewsCount,
    reviewsAverage,
  };
}
