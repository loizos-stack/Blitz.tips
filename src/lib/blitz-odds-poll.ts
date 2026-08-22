import "server-only";
import type { PickSport } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { oddsApiKey, ODDS_API_BASE, watchableSportKeys } from "@/lib/odds-api";
import { formatMatchup } from "@/lib/utils";
import {
  GAME_LINE_MARKETS,
  alternateMarkets,
  propMarkets,
  soccerExtraMarkets,
  watchMarketLabel,
  type WatchMarket,
} from "@/lib/blitz-odds-markets";
import {
  detectDrop,
  lineKey,
  minutesToStart,
  withinAlertWindow,
  isNewInformation,
  validAmerican,
  type BookHistory,
} from "@/lib/blitz-odds";

/**
 * Blitz Odds — the poll cycle.
 *
 * COST IS THE DESIGN. The upstream bills every odds request as
 * (markets x regions), and the rest of this site runs on roughly 1,600 credits
 * a month by caching odds for a full day. A drop detector cannot cache: it
 * exists to see change, so it must re-ask, and re-asking is the entire expense.
 *
 * Two tiers, and the gap between them is enormous:
 *
 *   Game lines  — ONE bulk request per league returns every upcoming event with
 *                 every book. 3 markets x 1 region = 3 credits, whether the
 *                 league has one game or forty. This is nearly free and is why
 *                 it is the default.
 *
 *   Deep markets — alternates, player props, corners and cards are only offered
 *                 per event. Roughly 6-15 markets x 1 region *per game*. A slate
 *                 of 40 games polled every ten minutes costs more in an
 *                 afternoon than the whole site does in a year.
 *
 * So the deep tier is opt-in, capped at `maxDeepEvents` games per run, and the
 * whole cycle stops dead at `dailyCreditCap`. The cap is checked before each
 * request against that request's own price, so the ceiling cannot be stepped
 * over by a large request — it is a ceiling, not a suggestion.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/** How far back the detector compares. Older snapshots are still pruned later. */
const LOOKBACK_MINUTES = 90;

/** Snapshots are worthless once a game is under way; keep a small tail for the feed. */
const SNAPSHOT_RETENTION_HOURS = 6;

export interface RunReport {
  ran: boolean;
  credits: number;
  requests: number;
  eventsSeen: number;
  dropsFound: number;
  stoppedReason: string | null;
  error: string | null;
  /** Market keys that returned data this run — feeds the "verified" column. */
  marketsSeen: string[];
}

export interface WatchSettings {
  enabled: boolean;
  pollMinutes: number;
  leadHours: number;
  cutoffMinutes: number;
  minProbDelta: number;
  minBooks: number;
  watchGameLines: boolean;
  watchAlternates: boolean;
  watchProps: boolean;
  watchSoccerExtras: boolean;
  dailyCreditCap: number;
  maxDeepEvents: number;
  sportKeys: string;
  notifyOnSite: boolean;
  notifyPush: boolean;
  notifyTelegram: boolean;
  telegramChatId: string;
  leaguesJson: string;
  leaguesAt: Date | null;
}

/** Reads the single settings row, creating it with defaults on first use. */
export async function getWatchSettings(): Promise<WatchSettings> {
  const row = await prisma.oddsWatchSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return row;
}

/** Credits already spent today, which is what the cap is measured against. */
export async function creditsUsedToday(now = new Date()): Promise<number> {
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  const agg = await prisma.oddsPollRun.aggregate({
    where: { startedAt: { gte: midnight } },
    _sum: { credits: true },
  });
  return agg._sum.credits ?? 0;
}

/**
 * Sports the watcher covers. Soccer and tennis fan out to many league keys, so
 * this resolves through the same helper the board uses.
 */
const WATCH_SPORTS: PickSport[] = [
  "NFL",
  "NBA",
  "WNBA",
  "MLB",
  "NHL",
  "NCAAF",
  "NCAAB",
  "SOCCER",
  "UFC_MMA",
  "TENNIS",
];

/**
 * How long a resolved league list is reused.
 *
 * Resolving is not free: soccer probes nine dormant competition keys and each
 * probe is a billed request. Re-resolving every cycle would spend more deciding
 * what to watch than watching costs. Leagues change on the timescale of a
 * season, so six hours is generous.
 */
const LEAGUE_CACHE_HOURS = 6;

interface League {
  sport: PickSport;
  sportKey: string;
}

async function resolveLeagues(settings: WatchSettings, now = new Date()): Promise<League[]> {
  const configured = settings.sportKeys
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filter = (all: League[]) =>
    configured.length === 0 ? all : all.filter((l) => configured.includes(l.sportKey));

  const fresh =
    settings.leaguesAt !== null &&
    now.getTime() - settings.leaguesAt.getTime() < LEAGUE_CACHE_HOURS * 3_600_000;

  if (fresh && settings.leaguesJson) {
    try {
      return filter(JSON.parse(settings.leaguesJson) as League[]);
    } catch {
      // Fall through and re-resolve rather than watching nothing.
    }
  }

  const all: League[] = [];
  for (const sport of WATCH_SPORTS) {
    for (const sportKey of await watchableSportKeys(sport)) all.push({ sport, sportKey });
  }

  await prisma.oddsWatchSettings.update({
    where: { id: "default" },
    data: { leaguesJson: JSON.stringify(all), leaguesAt: now },
  });

  return filter(all);
}

// --- Wire shapes -----------------------------------------------------------

interface ApiOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}
interface ApiMarket {
  key: string;
  outcomes?: ApiOutcome[];
}
interface ApiBookmaker {
  key: string;
  title: string;
  markets?: ApiMarket[];
}
interface ApiEvent {
  id: string;
  sport_key?: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: ApiBookmaker[];
}

/**
 * A running tally of what this cycle has spent.
 *
 * Kept as an object passed by reference rather than a module global so two
 * concurrent runs — a cron firing while a manual run is open in the panel —
 * cannot silently share a counter and each conclude it is under budget.
 */
interface Budget {
  spent: number;
  requests: number;
  cap: number;
  stopped: string | null;
}

/**
 * Spend for one request, or refuse.
 *
 * The price is computed before the call and checked against the remaining
 * budget, so a 15-market per-event request cannot sail past a cap with 3
 * credits left on it.
 */
function afford(budget: Budget, markets: number, regions: number): boolean {
  const price = markets * regions;
  if (budget.spent + price > budget.cap) {
    budget.stopped = `Daily credit cap reached (${budget.cap}).`;
    return false;
  }
  budget.spent += price;
  budget.requests += 1;
  return true;
}

async function fetchOdds(url: string): Promise<ApiEvent[] | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`Blitz Odds request failed: ${res.status}`);
      return null;
    }
    const json = await res.json();
    return Array.isArray(json) ? (json as ApiEvent[]) : [json as ApiEvent];
  } catch (e) {
    console.error("Blitz Odds request errored:", e);
    return null;
  }
}

/**
 * Flatten one event's books into snapshot rows.
 *
 * `description` carries the player on a prop market, and it is prepended to the
 * selection because without it every player's "Over" collapses into one line —
 * the detector would compare one player's price to another's and call the
 * difference a drop.
 */
function snapshotRows(
  ev: ApiEvent,
  sportKey: string,
  capturedAt: Date
): { rows: SnapshotRow[]; marketsSeen: Set<string> } {
  const rows: SnapshotRow[] = [];
  const marketsSeen = new Set<string>();
  const commenceTime = new Date(ev.commence_time);

  for (const book of ev.bookmakers ?? []) {
    for (const market of book.markets ?? []) {
      for (const o of market.outcomes ?? []) {
        if (!validAmerican(o.price)) continue;
        marketsSeen.add(market.key);
        const selection = o.description ? `${o.description} ${o.name}` : o.name;
        rows.push({
          eventId: ev.id,
          sportKey,
          marketKey: market.key,
          selection,
          point: o.point ?? null,
          bookmaker: book.title || book.key,
          price: Math.round(o.price),
          commenceTime,
          capturedAt,
        });
      }
    }
  }
  return { rows, marketsSeen };
}

interface SnapshotRow {
  eventId: string;
  sportKey: string;
  marketKey: string;
  selection: string;
  point: number | null;
  bookmaker: string;
  price: number;
  commenceTime: Date;
  capturedAt: Date;
}

/** Markets requested for the deep, per-event tier. */
function deepMarketsFor(sportKey: string, settings: WatchSettings): WatchMarket[] {
  const out: WatchMarket[] = [];
  if (settings.watchAlternates) out.push(...alternateMarkets(sportKey));
  if (settings.watchProps) out.push(...propMarkets(sportKey));
  if (settings.watchSoccerExtras) out.push(...soccerExtraMarkets(sportKey));
  return out;
}

export interface DetectedDrop {
  eventId: string;
  sportKey: string;
  sport: PickSport;
  matchup: string;
  commenceTime: Date;
  marketKey: string;
  marketLabel: string;
  selection: string;
  point: number | null;
  bookCount: number;
  books: string;
  openPrice: number;
  currentPrice: number;
  probDelta: number;
  minutesToStart: number;
}

/**
 * Compare the stored history for the events just polled and return new drops.
 *
 * Reads back from the database rather than working off this run's response
 * alone, because a drop is by definition a comparison against an earlier poll —
 * the first run after enabling the tool will correctly find nothing.
 */
export async function detectDropsFor(
  events: { eventId: string; sport: PickSport; sportKey: string; matchup: string; commenceTime: Date }[],
  settings: WatchSettings,
  now: Date
): Promise<DetectedDrop[]> {
  const found: DetectedDrop[] = [];
  const since = new Date(now.getTime() - LOOKBACK_MINUTES * 60_000);

  for (const ev of events) {
    if (!withinAlertWindow(ev.commenceTime, now, settings.cutoffMinutes)) continue;

    const snaps = await prisma.oddsSnapshot.findMany({
      where: { eventId: ev.eventId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });
    if (snaps.length === 0) continue;

    // Group into one history per (line, book).
    const lines = new Map<string, Map<string, BookHistory>>();
    for (const s of snaps) {
      const lk = lineKey(s.marketKey, s.selection, s.point);
      let books = lines.get(lk);
      if (!books) lines.set(lk, (books = new Map()));
      let hist = books.get(s.bookmaker);
      if (!hist) books.set(s.bookmaker, (hist = { bookmaker: s.bookmaker, prices: [] }));
      hist.prices.push({ price: s.price, capturedAt: s.capturedAt });
    }

    for (const [lk, books] of lines) {
      const signal = detectDrop([...books.values()], {
        minProbDelta: settings.minProbDelta,
        minBooks: settings.minBooks,
      });
      if (!signal) continue;

      const [marketKey, selection, pointRaw] = lk.split("|");
      const point = pointRaw === "" ? null : Number(pointRaw);

      // Only report what wasn't already reported. Without this the same line
      // re-alerts on every cycle for as long as it stays shortened.
      const prior = await prisma.oddsDrop.findFirst({
        where: { eventId: ev.eventId, marketKey, selection, point },
        orderBy: { detectedAt: "desc" },
      });
      if (!isNewInformation(signal, prior?.probDelta ?? null, settings.minProbDelta)) continue;

      found.push({
        eventId: ev.eventId,
        sportKey: ev.sportKey,
        sport: ev.sport,
        matchup: ev.matchup,
        commenceTime: ev.commenceTime,
        marketKey,
        marketLabel: watchMarketLabel(marketKey),
        selection,
        point,
        bookCount: signal.moves.length,
        books: signal.moves.map((m) => m.bookmaker).join(", "),
        openPrice: signal.openPrice,
        currentPrice: signal.currentPrice,
        probDelta: Number(signal.probDelta.toFixed(2)),
        minutesToStart: minutesToStart(ev.commenceTime, now),
      });
    }
  }

  return found;
}

/**
 * One full cycle: poll, store, detect, record.
 *
 * Notification is deliberately not done here — see notifyDrops in
 * lib/blitz-odds-notify. Splitting them means a delivery failure cannot lose
 * the detection, and the panel can re-send without re-polling (and re-paying).
 */
export async function runBlitzOdds(now = new Date()): Promise<RunReport> {
  const empty: RunReport = {
    ran: false,
    credits: 0,
    requests: 0,
    eventsSeen: 0,
    dropsFound: 0,
    stoppedReason: null,
    error: null,
    marketsSeen: [],
  };

  const settings = await getWatchSettings();
  if (!settings.enabled) return { ...empty, stoppedReason: "Watcher is switched off." };

  const apiKey = oddsApiKey();
  if (!apiKey) return { ...empty, stoppedReason: "THE_ODDS_API_KEY is not set." };

  const alreadySpent = await creditsUsedToday(now);
  const budget: Budget = {
    spent: 0,
    requests: 0,
    cap: Math.max(0, settings.dailyCreditCap - alreadySpent),
    stopped: null,
  };
  if (budget.cap <= 0) {
    return { ...empty, stoppedReason: `Daily credit cap reached (${settings.dailyCreditCap}).` };
  }

  const run = await prisma.oddsPollRun.create({ data: {} });
  const marketsSeen = new Set<string>();
  const seenEvents = new Map<
    string,
    { eventId: string; sport: PickSport; sportKey: string; matchup: string; commenceTime: Date }
  >();
  let dropsFound = 0;
  let error: string | null = null;

  try {
    const windowEnd = new Date(now.getTime() + settings.leadHours * 3_600_000);
    const leagues = await resolveLeagues(settings);
    const pending: SnapshotRow[] = [];

    // --- Tier 1: game lines, one bulk request per league --------------------
    if (settings.watchGameLines) {
      const markets = GAME_LINE_MARKETS.map((m) => m.key);
      for (const { sport, sportKey } of leagues) {
        if (!afford(budget, markets.length, 1)) break;

        const url =
          `${ODDS_API_BASE}/sports/${sportKey}/odds` +
          `?apiKey=${apiKey}&regions=us&oddsFormat=american&markets=${markets.join(",")}`;
        const events = await fetchOdds(url);
        if (!events) continue;

        for (const ev of events) {
          const commenceTime = new Date(ev.commence_time);
          // Outside the watch window, or too close to kickoff to act on.
          if (commenceTime > windowEnd) continue;
          if (!withinAlertWindow(commenceTime, now, settings.cutoffMinutes)) continue;

          const { rows, marketsSeen: seen } = snapshotRows(ev, sportKey, now);
          pending.push(...rows);
          for (const k of seen) marketsSeen.add(k);
          seenEvents.set(ev.id, {
            eventId: ev.id,
            sport,
            sportKey,
            // `sport` (not the league key) — formatMatchup switches on the
            // PickSport name to pick "@" for the US leagues and "vs" elsewhere.
            matchup: formatMatchup(sport, ev.away_team ?? "", ev.home_team ?? ""),
            commenceTime,
          });
        }
      }
    }

    // --- Tier 2: deep markets, per event ------------------------------------
    // Soonest kickoffs first: those are the games whose lines are moving and
    // the ones there is least time left to act on.
    const deepCandidates = [...seenEvents.values()]
      .sort((a, b) => a.commenceTime.getTime() - b.commenceTime.getTime())
      .slice(0, settings.maxDeepEvents);

    for (const ev of deepCandidates) {
      const markets = deepMarketsFor(ev.sportKey, settings);
      if (markets.length === 0) continue;
      if (!afford(budget, markets.length, 1)) break;

      const url =
        `${ODDS_API_BASE}/sports/${ev.sportKey}/events/${ev.eventId}/odds` +
        `?apiKey=${apiKey}&regions=us&oddsFormat=american&markets=${markets.map((m) => m.key).join(",")}`;
      const events = await fetchOdds(url);
      if (!events) continue;

      for (const raw of events) {
        const { rows, marketsSeen: seen } = snapshotRows(raw, ev.sportKey, now);
        pending.push(...rows);
        for (const k of seen) marketsSeen.add(k);
      }
    }

    if (pending.length > 0) {
      await prisma.oddsSnapshot.createMany({ data: pending });
    }

    const drops = await detectDropsFor([...seenEvents.values()], settings, now);
    dropsFound = drops.length;
    if (drops.length > 0) {
      await prisma.oddsDrop.createMany({ data: drops });
    }

    await pruneSnapshots(now);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error("Blitz Odds run failed:", e);
  }

  await prisma.oddsPollRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      credits: budget.spent,
      requests: budget.requests,
      eventsSeen: seenEvents.size,
      dropsFound,
      stoppedReason: budget.stopped,
      error,
    },
  });

  return {
    ran: true,
    credits: budget.spent,
    requests: budget.requests,
    eventsSeen: seenEvents.size,
    dropsFound,
    stoppedReason: budget.stopped,
    error,
    marketsSeen: [...marketsSeen],
  };
}

/**
 * Drop snapshots that can no longer inform a comparison.
 *
 * This table is the only one in the app that grows on a timer rather than with
 * use — a busy slate at full depth writes hundreds of thousands of rows a day —
 * so pruning is part of the cycle, not a chore left for later.
 */
export async function pruneSnapshots(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SNAPSHOT_RETENTION_HOURS * 3_600_000);
  const { count } = await prisma.oddsSnapshot.deleteMany({ where: { capturedAt: { lt: cutoff } } });
  return count;
}

/**
 * What a run would cost at the current settings, without spending anything.
 *
 * Shown in the panel before the switch is thrown. The whole point of this tool
 * failing quietly is a drained quota, and a number on screen beforehand is the
 * cheapest possible way to avoid that.
 */
export async function estimateRunCost(
  settings: WatchSettings
): Promise<{ leagues: number; gameLineCredits: number; deepCredits: number; perRun: number; perDay: number }> {
  const leagues = await resolveLeagues(settings);
  const gameLineCredits = settings.watchGameLines ? leagues.length * GAME_LINE_MARKETS.length : 0;

  // Deep spend is per event and dominated by whichever sport is deepest, so the
  // estimate uses the widest market list any watched league would ask for —
  // an estimate that under-promises is worse than useless here.
  const widest = leagues.reduce((max, l) => Math.max(max, deepMarketsFor(l.sportKey, settings).length), 0);
  const deepCredits = widest * settings.maxDeepEvents;

  const perRun = gameLineCredits + deepCredits;
  const runsPerDay = settings.pollMinutes > 0 ? Math.floor((24 * 60) / settings.pollMinutes) : 0;
  return { leagues: leagues.length, gameLineCredits, deepCredits, perRun, perDay: perRun * runsPerDay };
}
