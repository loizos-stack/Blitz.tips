import "server-only";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { getSetting } from "@/lib/settings";
import { listHandicapperDirectory } from "@/lib/handicappers";
import { X_MAX_CHARS, xLength } from "@/lib/x-api";
import { SPORT_LABELS } from "@/lib/utils";

/**
 * The daily X rotation: five posts, four to five hours apart.
 *
 * ## Nothing here is written by hand
 *
 * Every figure in a post comes out of the database at the moment it is
 * composed. That is the whole point of the account: the site's claim is that
 * records are verifiable, and a post quoting a number nobody can check would
 * undercut it. It is also why a slot with no data to fill it is SKIPPED rather
 * than softened into something vague — "one of our cappers is doing well" is
 * the kind of post that makes the real ones less believable.
 *
 * ## The slots are different shapes on purpose
 *
 * Five posts a day from one account reads as a bot if they share a shape. Each
 * slot has its own: a fact about today, a record, a ranking, a result, a pitch.
 * Two of them are about Gold cappers, which is what the plan is sold on.
 *
 * ## Scheduling lives outside this file
 *
 * Vercel's Hobby plan allows daily crons only, so a Cloudflare Worker calls
 * /api/cron/x-post on each slot's schedule — see workers/x-rotation. This
 * module does not know or care what time it is beyond "which slot was asked
 * for".
 */

import type { XSlot } from "@/lib/x-slots";

export { X_SLOTS, SLOT_LABELS, slotLabel } from "@/lib/x-slots";
export type { XSlot } from "@/lib/x-slots";

/** Whether composed posts go out by themselves or wait to be approved. */
export async function autoSendEnabled(): Promise<boolean> {
  return (await getSetting("x.autoSend")) === "true";
}

export interface ComposedPost {
  slot: XSlot;
  text: string;
  /** Absolute URL of the card to attach, fetched at send time. */
  imageUrl: string | null;
  /** The handicapper this is about, if any — used to avoid repeats. */
  subject: string | null;
}

/** Why a slot produced nothing. Shown in the admin so silence is explainable. */
export interface SkippedPost {
  slot: XSlot;
  reason: string;
}

export type CompositionResult = ComposedPost | SkippedPost;

export function isSkipped(r: CompositionResult): r is SkippedPost {
  return "reason" in r;
}

/** `+23.4u` / `-4.0u` — the sign is the point, so it is always shown. */
function units(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}u`;
}

/**
 * How long before kickoff a pick went up, in the plainest possible words.
 *
 * This is the one claim a screenshot cannot make, so it is worth saying
 * precisely rather than as "hours before".
 */
function leadTime(postedAt: Date, startsAt: Date): string | null {
  const mins = Math.round((startsAt.getTime() - postedAt.getTime()) / 60_000);
  if (mins < 1) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Compose the post for one slot, or explain why there isn't one.
 *
 * `now` is injectable so the behaviour around a day boundary can be tested
 * without waiting for one.
 */
export async function composeSlot(slot: XSlot, now: Date = new Date()): Promise<CompositionResult> {
  switch (slot) {
    case "board":
      return composeBoard(now);
    case "gold":
      return composeGold();
    case "leaderboard":
      return composeLeaderboard();
    case "winner":
      return composeWinner(now);
    case "recruit":
      return composeRecruit();
  }
}

/** Today's slate, counted from picks' events rather than from the odds feed. */
async function composeBoard(now: Date): Promise<CompositionResult> {
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const picks = await prisma.pick.findMany({
    where: { eventStartsAt: { gte: now, lte: endOfDay } },
    select: { sport: true, matchup: true },
  });
  if (picks.length === 0) {
    return { slot: "board", reason: "No games on the board between now and the end of the day." };
  }

  const games = new Set(picks.map((p) => p.matchup)).size;
  const leagues = [...new Set(picks.map((p) => SPORT_LABELS[p.sport] ?? p.sport))];
  const leagueList =
    leagues.length === 1
      ? leagues[0]
      : `${leagues.slice(0, -1).join(", ")} and ${leagues[leagues.length - 1]}`;

  return {
    slot: "board",
    subject: null,
    imageUrl: `${siteUrl()}/opengraph-image`,
    text:
      `Today's board is live. ${games} ${games === 1 ? "game" : "games"} across ${leagueList}, all priced.\n\n` +
      `Every pick posted on Blitz is timestamped before kickoff. No exceptions.\n\n` +
      siteUrl().replace(/^https?:\/\//, ""),
  };
}

/**
 * A Gold capper, chosen as the one longest since they were last featured.
 *
 * Rotating by last-featured rather than by record keeps the account from
 * becoming one person's highlight reel, and means a new Gold signing appears
 * promptly instead of waiting to out-earn everyone.
 */
async function composeGold(): Promise<CompositionResult> {
  const directory = await listHandicapperDirectory();
  const gold = directory.filter((h) => h.isFeatured && h.stats.totalPicks > 0);
  if (gold.length === 0) {
    return { slot: "gold", reason: "No Gold-plan handicappers with a settled record yet." };
  }

  const recent = await prisma.xQueuedPost.findMany({
    where: { slot: "gold", subject: { not: null } },
    orderBy: { createdAt: "desc" },
    take: gold.length,
    select: { subject: true },
  });
  const seen = recent.map((r) => r.subject);
  // Whoever has gone longest without a turn; ties fall to the better record.
  const pick =
    gold
      .map((h) => ({ h, last: seen.indexOf(h.handle) }))
      .sort((a, b) => {
        const aLast = a.last === -1 ? Number.POSITIVE_INFINITY : -a.last;
        const bLast = b.last === -1 ? Number.POSITIVE_INFINITY : -b.last;
        if (aLast !== bLast) return bLast - aLast;
        return b.h.stats.unitsNet - a.h.stats.unitsNet;
      })[0]?.h ?? gold[0]!;

  const s = pick.stats;
  const roi = s.roi === null ? null : `${s.roi >= 0 ? "" : ""}${s.roi.toFixed(1)}%`;
  const win = s.winRate === null ? null : `${s.winRate.toFixed(1)}%`;

  const figures = [
    `${units(s.unitsNet)} from ${s.totalPicks} picks`,
    win && `${win} winners`,
    roi && `ROI ${roi}`,
    pick.last10Stats ? `Last 10: ${pick.last10Stats.record}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    slot: "gold",
    subject: pick.handle,
    imageUrl: `${siteUrl()}/handicappers/${pick.handle}/opengraph-image`,
    text:
      `GOLD CAPPER · @${pick.handle}\n\n` +
      `${figures}.\n\n` +
      `Every one of those picks went up before the game started. That is why the number means something.\n\n` +
      `${siteUrl().replace(/^https?:\/\//, "")}/handicappers/${pick.handle}`,
  };
}

/** The leaderboard's own argument, pointed at the page that proves it. */
async function composeLeaderboard(): Promise<CompositionResult> {
  const directory = await listHandicapperDirectory();
  const ranked = directory.filter((h) => h.stats.totalPicks > 0);
  if (ranked.length < 3) {
    return { slot: "leaderboard", reason: "Fewer than three handicappers with a settled record." };
  }

  return {
    slot: "leaderboard",
    subject: null,
    imageUrl: `${siteUrl()}/leaderboard/opengraph-image`,
    text:
      `This week's top five by units won.\n\n` +
      `Nobody on this list chose which results you get to see. The leaderboard counts every pick they have ever posted, wins and losses.\n\n` +
      `${siteUrl().replace(/^https?:\/\//, "")}/leaderboard`,
  };
}

/**
 * A pick that settled as a win today, preferring Gold cappers.
 *
 * Only a pick that was PUBLIC when it ran is eligible: posting the selection
 * from someone's paid tier would give away what subscribers paid for.
 */
async function composeWinner(now: Date): Promise<CompositionResult> {
  const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const wins = await prisma.pick.findMany({
    where: {
      result: "WIN",
      isPremium: false,
      eventStartsAt: { gte: dayStart, lte: now },
    },
    orderBy: { eventStartsAt: "desc" },
    take: 25,
    include: {
      handicapper: { select: { handle: true, displayName: true, plan: true, planStatus: true } },
    },
  });
  if (wins.length === 0) {
    return { slot: "winner", reason: "No free picks settled as wins in the last 24 hours." };
  }

  // Gold first — the plan is what the account is selling — then the biggest
  // stake, which is the capper's own statement of confidence.
  const best =
    wins
      .slice()
      .sort((a, b) => {
        const aGold = a.handicapper.plan === "GOLD" && a.handicapper.planStatus === "ACTIVE" ? 1 : 0;
        const bGold = b.handicapper.plan === "GOLD" && b.handicapper.planStatus === "ACTIVE" ? 1 : 0;
        if (aGold !== bGold) return bGold - aGold;
        return b.units - a.units;
      })[0]!;

  const lead = leadTime(best.createdAt, best.eventStartsAt);
  const odds = best.odds > 0 ? `+${best.odds}` : `${best.odds}`;

  return {
    slot: "winner",
    subject: best.handicapper.handle,
    imageUrl: `${siteUrl()}/api/share/pick/${best.id}`,
    text:
      `WINNER. @${best.handicapper.handle} took ${best.selection} (${odds}) for ${best.units}u.\n\n` +
      (lead
        ? `Posted ${lead} before kick-off, graded automatically when the game finished. The timestamp is on the pick.\n\n`
        : `Graded automatically when the game finished. The timestamp is on the pick.\n\n`) +
      `${siteUrl().replace(/^https?:\/\//, "")}/handicappers/${best.handicapper.handle}`,
  };
}

/**
 * The only slot aimed at sellers rather than buyers, and the only evergreen
 * one — it has no data to be missing, so it can stand in for a slot that was
 * skipped.
 */
async function composeRecruit(): Promise<CompositionResult> {
  return {
    slot: "recruit",
    subject: null,
    imageUrl: `${siteUrl()}/opengraph-image`,
    text:
      `Selling picks on your own?\n\n` +
      `On Blitz, Gold keeps you 90% of every subscription, puts you at the top of the homepage and the leaderboard, and grades your record for you.\n\n` +
      `${siteUrl().replace(/^https?:\/\//, "")}/signup`,
  };
}

/**
 * Compose a slot, falling back to the evergreen recruiting post when the asked-for
 * one has nothing to say.
 *
 * The fallback runs at most once a day. Five recruiting posts on a quiet
 * Tuesday would be worse than silence, and silence is a perfectly good outcome
 * for an account whose whole pitch is that it only states things it can prove.
 */
export async function composeForSlot(slot: XSlot, now: Date = new Date()): Promise<CompositionResult> {
  const first = await composeSlot(slot, now);
  if (!isSkipped(first) || slot === "recruit") return first;

  const fallback = await composeRecruit();
  if (isSkipped(fallback)) return first;

  // The fallback is filed under the slot that ASKED for it, so that slot's own
  // once-a-day guard still works. That also means the row's `slot` cannot say
  // whether the recruiting pitch has already gone out today — a fallback for
  // the board is stored as "board". Match on the text, which is the same words
  // every time, and so catches both the scheduled recruit post and an earlier
  // fallback.
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const saidToday = await prisma.xQueuedPost.findFirst({
    where: {
      text: fallback.text,
      createdAt: { gte: dayStart },
      status: { in: ["PENDING", "SENT"] },
    },
    select: { id: true },
  });
  if (saidToday) return first;

  return { ...fallback, slot };
}

/** Guard against a composition that X would reject outright. */
export function withinLimit(text: string): boolean {
  return xLength(text) <= X_MAX_CHARS;
}
