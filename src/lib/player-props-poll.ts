import "server-only";
import type { PickSport } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { oddsApiKey, ODDS_API_BASE, watchableSportKeys } from "@/lib/odds-api";
import { propMarketKeys, oddsGroup, type OddsGroup } from "@/lib/odds-markets";
import {
  detectPlayerSignals,
  isNewInformation,
  validAmerican,
  type LineHistory,
  type ClusterOpts,
  type PlayerSignal,
} from "@/lib/player-props";

/**
 * The Player Props watcher: one cycle of look, store, compare, raise.
 *
 * COST IS THE WHOLE DESIGN, exactly as it was for the board. The Odds API bills
 * a per-event odds request as (markets × regions), and player props are sold
 * per event rather than per league — there is no bulk call. Asking for ten
 * basketball prop markets on one game costs ten credits, every time, and
 * nothing about the request gets cheaper because we asked five minutes ago.
 *
 * So the arithmetic that matters is: markets × events × polls per day. Ten
 * markets across six games polled every ten minutes is 8,640 credits a day —
 * more than the whole rest of the site spends in a month. Every lever that
 * multiplies out is therefore a setting with a conservative default, the cycle
 * checks the daily cap before each request against that request's own price,
 * and the panel shows the projection before the switch is thrown.
 *
 * The event list itself is free: the bare /events endpoint carries no odds and
 * is not billed, so working out which games are close to kickoff costs nothing.
 * Only the prop fetch is charged.
 */

/**
 * How often the cycle actually runs, in minutes.
 *
 * MUST MATCH the schedule in .github/workflows/player-props.yml. It is stated
 * here rather than derived because nothing in the app can read its own
 * scheduler, and a spend projection quoting a cadence nobody keeps is worse
 * than no projection — it is a number that looks checked.
 *
 * The schedule is a GitHub workflow rather than a Vercel cron because this
 * account is on Hobby, which rejects any cron that runs more than once a day
 * ("Hobby accounts are limited to daily cron jobs" — the deploy fails outright,
 * it does not silently degrade). Five minutes is GitHub's floor, and half the
 * default cluster window, so one late run still leaves two samples inside it.
 */
export const POLL_MINUTES = 5;

/**
 * Player-prop markets only.
 *
 * The shared catalog's "props" tier means "sport-specific extras", which for
 * soccer is draw-no-bet and both-teams-to-score — team markets with no player
 * attached. Filtering on the key prefix keeps this watcher to lines that name
 * somebody, which is the only thing it can cluster by.
 */
export function playerPropMarkets(sportKey: string): string[] {
  return propMarketKeys(sportKey).filter(
    (k) => k.startsWith("player_") || k.startsWith("batter_") || k.startsWith("pitcher_")
  );
}

/**
 * A smaller set to fall back to.
 *
 * One market key a sport does not carry returns 422 for the WHOLE request, so a
 * single unsupported key would otherwise blank a sport permanently. These are
 * the markets every US book posts for every game in that sport.
 */
const CORE_MARKETS: Record<OddsGroup, string[]> = {
  football: ["player_pass_yds", "player_rush_yds", "player_reception_yds", "player_anytime_td"],
  basketball: ["player_points", "player_rebounds", "player_assists"],
  baseball: ["batter_hits", "batter_total_bases", "pitcher_strikeouts"],
  hockey: ["player_points", "player_shots_on_goal", "player_goal_scorer_anytime"],
  soccer: [],
  other: [],
};

/** Every sport this watcher can say anything about. */
export const PROP_SPORTS: PickSport[] = ["NFL", "NCAAF", "NBA", "WNBA", "NCAAB", "MLB", "NHL"];

export interface PropSettings {
  enabled: boolean;
  sports: string;
  windowMinutes: number;
  clusterMinutes: number;
  minProps: number;
  minBooks: number;
  minProbDelta: number;
  countLineMoves: boolean;
  dailyCreditCap: number;
  maxEventsPerRun: number;
}


export async function getPropSettings(): Promise<PropSettings> {
  const row = await prisma.propWatchSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return {
    enabled: row.enabled,
    sports: row.sports,
    windowMinutes: row.windowMinutes,
    clusterMinutes: row.clusterMinutes,
    minProps: row.minProps,
    minBooks: row.minBooks,
    minProbDelta: row.minProbDelta,
    countLineMoves: row.countLineMoves,
    dailyCreditCap: row.dailyCreditCap,
    maxEventsPerRun: row.maxEventsPerRun,
  };
}

/** The sports actually being watched, after the settings filter. */
export function watchedSports(settings: PropSettings): PickSport[] {
  const configured = settings.sports
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (configured.length === 0) return PROP_SPORTS;
  return PROP_SPORTS.filter((s) => configured.includes(s));
}

/** Credits spent since midnight, from the run log. */
export async function creditsUsedToday(): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const agg = await prisma.propPollRun.aggregate({
    where: { startedAt: { gte: since } },
    _sum: { credits: true },
  });
  return agg._sum.credits ?? 0;
}

export interface CostEstimate {
  /** Credits for one event, which is one market list at one region. */
  perEvent: number;
  /** Worst case for one cycle: every event slot filled. */
  perRun: number;
  /** That, at the configured cadence, all day. */
  perDay: number;
  pollsPerDay: number;
  markets: number;
}

/**
 * What this will cost, before it is switched on.
 *
 * `pollMinutes` is not a setting — the schedule lives in vercel.json — so it is
 * passed in by whoever knows the cadence, and the panel states which number it
 * used rather than implying the tool controls it.
 */
export function estimateRunCost(settings: PropSettings, pollMinutes: number): CostEstimate {
  const sports = watchedSports(settings);
  // The widest market list among the watched sports: the worst case is what the
  // cap has to survive, and a mixed slate bills at each sport's own width.
  const markets = Math.max(
    0,
    ...sports.map((s) => CORE_MARKETS[groupForSport(s)].length),
    ...sports.map((s) => playerPropMarkets(sportKeyHint(s)).length)
  );
  const perEvent = markets; // regions=us is one region
  const perRun = perEvent * settings.maxEventsPerRun;
  const pollsPerDay = Math.max(1, Math.floor((24 * 60) / Math.max(1, pollMinutes)));
  return { perEvent, perRun, perDay: perRun * pollsPerDay, pollsPerDay, markets };
}

/** A representative upstream key per sport, for catalog lookups only. */
function sportKeyHint(sport: PickSport): string {
  switch (sport) {
    case "NFL":
      return "americanfootball_nfl";
    case "NCAAF":
      return "americanfootball_ncaaf";
    case "NBA":
      return "basketball_nba";
    case "WNBA":
      return "basketball_wnba";
    case "NCAAB":
      return "basketball_ncaab";
    case "MLB":
      return "baseball_mlb";
    case "NHL":
      return "icehockey_nhl";
    default:
      return "";
  }
}

function groupForSport(sport: PickSport): OddsGroup {
  return oddsGroup(sportKeyHint(sport));
}

// --- upstream ---------------------------------------------------------------

interface FeedEvent {
  id: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
}

interface FeedOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}
interface FeedMarket {
  key: string;
  outcomes?: FeedOutcome[];
}
interface FeedBookmaker {
  key: string;
  markets?: FeedMarket[];
}
interface FeedEventOdds {
  id: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: FeedBookmaker[];
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Upcoming events for one league. Free — the bare /events endpoint carries no
 * odds, so deciding what to watch costs nothing.
 */
async function fetchEvents(sportKey: string, apiKey: string): Promise<{ events: FeedEvent[]; error: string | null }> {
  try {
    const res = await fetch(`${ODDS_API_BASE}/sports/${sportKey}/events?apiKey=${apiKey}`, {
      // A watcher that reads a cached schedule is watching the past.
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { events: [], error: `${sportKey} events: ${res.status} ${(await res.text()).slice(0, 160)}` };
    }
    return { events: (await res.json()) as FeedEvent[], error: null };
  } catch (e) {
    return { events: [], error: `${sportKey} events: ${e instanceof Error ? e.message : String(e)}` };
  }
}

interface OddsFetch {
  odds: FeedEventOdds | null;
  /** Credits actually spent, which is the width of the list that succeeded. */
  credits: number;
  degraded: boolean;
  error: string | null;
}

/**
 * One event's player props.
 *
 * Two tiers, for the reason getEventMarkets already has them: one market key a
 * sport does not carry 422s the entire request, so a wide list that fails falls
 * back to the markets every book posts rather than returning nothing at all.
 * A failed request is not counted as spend — the-odds-api bills successful
 * responses — and the tier that succeeded is what gets charged.
 */
async function fetchEventProps(
  sportKey: string,
  eventId: string,
  apiKey: string
): Promise<OddsFetch> {
  const wide = playerPropMarkets(sportKey);
  const core = CORE_MARKETS[oddsGroup(sportKey)];
  const tiers = [wide, core].filter((t, i, all) => t.length > 0 && all.findIndex((x) => x.join() === t.join()) === i);
  if (tiers.length === 0) {
    return { odds: null, credits: 0, degraded: false, error: `${sportKey} has no player-prop markets` };
  }

  let lastError: string | null = null;
  for (const [index, markets] of tiers.entries()) {
    const url =
      `${ODDS_API_BASE}/sports/${sportKey}/events/${eventId}/odds` +
      `?apiKey=${apiKey}&regions=us&oddsFormat=american&markets=${markets.join(",")}`;
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) {
        return {
          odds: (await res.json()) as FeedEventOdds,
          credits: markets.length,
          degraded: index > 0,
          error: null,
        };
      }
      lastError = `${sportKey}/${eventId}: ${res.status} ${(await res.text()).slice(0, 160)}`;
      // Only an unsupported-market error is worth a narrower retry; anything
      // else (a bad key, a quota wall) will fail identically the second time.
      if (res.status !== 422) break;
    } catch (e) {
      lastError = `${sportKey}/${eventId}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
  }
  return { odds: null, credits: 0, degraded: false, error: lastError };
}

// --- the cycle ---------------------------------------------------------------

export interface PropRunReport {
  ran: boolean;
  credits: number;
  requests: number;
  eventsSeen: number;
  playersSeen: number;
  signalsFound: number;
  /** Books the response actually carried, so a silent mismatch is visible. */
  booksSeen: string[];
  stoppedReason: string | null;
  error: string | null;
}

interface SnapshotRow {
  eventId: string;
  sportKey: string;
  matchup: string;
  player: string;
  marketKey: string;
  selection: string;
  point: number | null;
  bookmaker: string;
  price: number;
  commenceTime: Date;
}

/** Flatten one event's response into storable rows, keeping only real prices. */
export function rowsFromEvent(odds: FeedEventOdds, sportKey: string): SnapshotRow[] {
  const matchup = [odds.away_team, odds.home_team].filter(Boolean).join(" @ ") || odds.id;
  const commenceTime = new Date(odds.commence_time);
  const rows: SnapshotRow[] = [];

  for (const book of odds.bookmakers ?? []) {
    for (const market of book.markets ?? []) {
      for (const outcome of market.outcomes ?? []) {
        // No description means no player, and a line with no player is not
        // something this watcher can cluster — team totals slip in otherwise.
        const player = outcome.description?.trim();
        if (!player) continue;
        if (!validAmerican(outcome.price)) continue;
        rows.push({
          eventId: odds.id,
          sportKey,
          matchup,
          player,
          marketKey: market.key,
          selection: outcome.name,
          point: typeof outcome.point === "number" ? outcome.point : null,
          bookmaker: book.key,
          price: outcome.price,
          commenceTime,
        });
      }
    }
  }
  return rows;
}

/** Group stored snapshots into the per-line histories the detector wants. */
export function historiesFrom(
  snapshots: { player: string; marketKey: string; selection: string; bookmaker: string; price: number; point: number | null; capturedAt: Date }[]
): LineHistory[] {
  const map = new Map<string, LineHistory>();
  for (const s of snapshots) {
    const key = `${s.player}|${s.marketKey}|${s.selection}|${s.bookmaker}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { player: s.player, marketKey: s.marketKey, selection: s.selection, bookmaker: s.bookmaker, samples: [] };
      map.set(key, entry);
    }
    entry.samples.push({ price: s.price, point: s.point, at: s.capturedAt });
  }
  for (const entry of map.values()) entry.samples.sort((a, b) => a.at.getTime() - b.at.getTime());
  return [...map.values()];
}

/**
 * Snapshots older than the cluster window can never contribute to a future
 * comparison, and this table grows with time rather than with usage. An hour of
 * slack keeps a widened window working without a migration.
 */
export async function prunePropSnapshots(clusterMinutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - Math.max(60, clusterMinutes * 6) * 60_000);
  const { count } = await prisma.propSnapshot.deleteMany({ where: { capturedAt: { lt: cutoff } } });
  return count;
}

export async function runPlayerProps(now: Date = new Date()): Promise<PropRunReport> {
  const report: PropRunReport = {
    ran: false,
    credits: 0,
    requests: 0,
    eventsSeen: 0,
    playersSeen: 0,
    signalsFound: 0,
    booksSeen: [],
    stoppedReason: null,
    error: null,
  };

  const settings = await getPropSettings();
  if (!settings.enabled) {
    report.stoppedReason = "Watcher is switched off.";
    await recordRun(report);
    return report;
  }

  const apiKey = oddsApiKey();
  if (!apiKey) {
    report.error = "THE_ODDS_API_KEY is not set.";
    await recordRun(report);
    return report;
  }

  report.ran = true;

  const used = await creditsUsedToday();
  let budget = settings.dailyCreditCap - used;
  if (budget <= 0) {
    report.stoppedReason = `Daily credit cap reached (${used}/${settings.dailyCreditCap}).`;
    await recordRun(report);
    return report;
  }

  // --- which games are close enough to be worth watching (free) -------------
  const errors: string[] = [];
  const horizon = now.getTime() + settings.windowMinutes * 60_000;
  const candidates: { sportKey: string; event: FeedEvent }[] = [];

  for (const sport of watchedSports(settings)) {
    const keys = await watchableSportKeys(sport);
    for (const sportKey of keys) {
      const { events, error } = await fetchEvents(sportKey, apiKey);
      if (error) {
        errors.push(error);
        continue;
      }
      for (const event of events) {
        const starts = new Date(event.commence_time).getTime();
        if (starts >= now.getTime() && starts <= horizon) candidates.push({ sportKey, event });
      }
    }
  }

  if (candidates.length === 0) {
    report.stoppedReason = `No games kicking off within ${settings.windowMinutes} min.`;
    report.error = errors.length ? errors.join(" · ") : null;
    await recordRun(report);
    return report;
  }

  // Soonest first: a line that moves ten minutes before tip-off is the one
  // worth knowing about, and the event budget should be spent there.
  candidates.sort(
    (a, b) => new Date(a.event.commence_time).getTime() - new Date(b.event.commence_time).getTime()
  );
  const chosen = candidates.slice(0, settings.maxEventsPerRun);

  // --- fetch and store (billed) ---------------------------------------------
  const books = new Set<string>();
  const players = new Set<string>();
  const touchedEventIds: string[] = [];

  for (const { sportKey, event } of chosen) {
    const price = playerPropMarkets(sportKey).length || CORE_MARKETS[oddsGroup(sportKey)].length;
    if (price > budget) {
      report.stoppedReason = `Stopped at the daily cap — the next event costs ${price} and ${budget} remained.`;
      break;
    }

    const { odds, credits, degraded, error } = await fetchEventProps(sportKey, event.id, apiKey);
    if (error) {
      errors.push(error);
      continue;
    }
    if (!odds) continue;

    budget -= credits;
    report.credits += credits;
    report.requests += 1;
    report.eventsSeen += 1;
    if (degraded) {
      errors.push(`${sportKey}: the full prop list was refused, so only the core markets were read.`);
    }

    const rows = rowsFromEvent(odds, sportKey);
    if (rows.length === 0) continue;
    for (const r of rows) {
      books.add(r.bookmaker);
      players.add(r.player);
    }
    touchedEventIds.push(event.id);
    await prisma.propSnapshot.createMany({ data: rows });
  }

  report.booksSeen = [...books].sort();
  report.playersSeen = players.size;

  // --- detect ----------------------------------------------------------------
  // Clusters found but already reported. Counted separately so a quiet cycle
  // can say WHICH kind of quiet it was: nothing moved, or the thing that moved
  // is the same thing raised a few minutes ago. Reporting both as "nothing"
  // is how a working detector gets mistaken for a broken one.
  let suppressed = 0;
  if (touchedEventIds.length > 0) {
    const opts: ClusterOpts = {
      clusterMinutes: settings.clusterMinutes,
      minProps: settings.minProps,
      minBooks: settings.minBooks,
      minProbDelta: settings.minProbDelta,
      countLineMoves: settings.countLineMoves,
    };
    const since = new Date(now.getTime() - settings.clusterMinutes * 60_000);

    for (const eventId of touchedEventIds) {
      const snapshots = await prisma.propSnapshot.findMany({
        where: { eventId, capturedAt: { gte: since } },
        orderBy: { capturedAt: "asc" },
      });
      if (snapshots.length === 0) continue;

      const signals = detectPlayerSignals(historiesFrom(snapshots), opts, now);
      for (const signal of signals) {
        const stored = await storeSignal(signal, snapshots[0]!, settings, now);
        if (stored) report.signalsFound += 1;
        else suppressed += 1;
      }
    }
  }

  await prunePropSnapshots(settings.clusterMinutes);

  if (report.signalsFound === 0 && !report.stoppedReason) {
    report.stoppedReason =
      report.eventsSeen === 0
        ? "No event returned any player props."
        : suppressed > 0
          ? `Watched ${players.size} player(s) across ${report.eventsSeen} game(s); ${suppressed} cluster(s) still moving, already reported.`
          : `Watched ${players.size} player(s) across ${report.eventsSeen} game(s); nothing moved together.`;
  }
  report.error = errors.length ? errors.join(" · ") : null;

  await recordRun(report);
  return report;
}

/** Write a cluster, unless the same one was already raised inside the window. */
async function storeSignal(
  signal: PlayerSignal,
  context: { eventId: string; sportKey: string; matchup: string; commenceTime: Date },
  settings: PropSettings,
  now: Date
): Promise<boolean> {
  const previous = await prisma.propSignal.findFirst({
    where: { eventId: context.eventId, player: signal.player },
    orderBy: { detectedAt: "desc" },
    select: { markets: true, detectedAt: true },
  });

  const isNew = isNewInformation(
    signal,
    previous ? { markets: previous.markets.split(",").filter(Boolean), detectedAt: previous.detectedAt } : null,
    settings.clusterMinutes
  );
  if (!isNew) return false;

  await prisma.propSignal.create({
    data: {
      eventId: context.eventId,
      sportKey: context.sportKey,
      matchup: context.matchup,
      player: signal.player,
      marketCount: signal.markets.length,
      bookCount: signal.books.length,
      books: signal.books.join(","),
      markets: signal.markets.join(","),
      direction: signal.direction,
      topProbDelta: signal.topProbDelta,
      movesJson: JSON.stringify(signal.moves),
      minutesToStart: Math.max(
        0,
        Math.round((context.commenceTime.getTime() - now.getTime()) / 60_000)
      ),
      commenceTime: context.commenceTime,
    },
  });
  return true;
}

async function recordRun(report: PropRunReport): Promise<void> {
  await prisma.propPollRun.create({
    data: {
      credits: report.credits,
      requests: report.requests,
      eventsSeen: report.eventsSeen,
      playersSeen: report.playersSeen,
      signalsFound: report.signalsFound,
      stoppedReason: report.stoppedReason,
      error: report.error,
    },
  });
}
