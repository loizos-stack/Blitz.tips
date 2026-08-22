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
  rundownConfigured,
  rundownSportIds,
  fetchRundownDay,
  datesCovering,
} from "@/lib/blitz-odds-rundown";
import {
  detectDrop,
  lineKey,
  minutesToStart,
  inAlertWindow,
  inWatchWindow,
  isNewInformation,
  validAmerican,
  type BookHistory,
} from "@/lib/blitz-odds";

/**
 * Blitz Odds — the poll cycle.
 *
 * WHAT IT ANSWERS. Did this price shorten going into kickoff, at more than one
 * book? A baseline is taken 16-30 minutes out, the current price is read 10-15
 * minutes out, and an alert fires only on the difference between those two
 * bands. Movement earlier in the day is deliberately invisible to this tool,
 * and the alert band stops at 10 minutes so there is still time to act.
 *
 * COST IS THE DESIGN. The upstream bills every odds request as
 * (markets x regions), and the rest of this site runs on roughly 1,600 credits
 * a month by caching odds for a full day. A drop detector cannot cache — it
 * exists to see change — so re-asking is the entire expense.
 *
 * Three things keep that affordable, in order of how much they save:
 *
 *   1. Only games inside one of the two bands are fetched at all — never in the
 *      0-9 minute run-in, never beyond 30 minutes. Most leagues, most of the
 *      day, have no game in either, and the fixture cache means discovering
 *      that costs nothing (see refreshFixtures).
 *   2. Game lines come from ONE bulk request per league covering every game in
 *      it, at 3 markets x 1 region = 3 credits. Up to ten named books bill as a
 *      single region, so restricting to two books costs no more than one.
 *   3. Deep markets — alternates, props, corners, cards — are sold per event
 *      and cost multiples more, so they are opt-in and capped per cycle.
 *
 * The whole cycle stops dead at `dailyCreditCap`, checked before each request
 * against that request's own price, so the ceiling cannot be stepped over by a
 * large request.
 *
 * TIMING IS THE RISK, and the alert band is the binding constraint. Both bands
 * must actually be sampled: miss the baseline and there is nothing to compare,
 * miss the alert band and nothing is ever reported. The baseline band is 15
 * minutes wide and forgiving; the alert band is only 6, so a scheduler that
 * drifts by more than a few minutes will simply skip games. That is why the
 * workflow polls several times per scheduled run rather than once.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/** Snapshots are worthless once a game is under way; keep a small tail for the feed. */
const SNAPSHOT_RETENTION_HOURS = 6;

/**
 * How long a cached fixture list is reused before being refetched.
 *
 * Kickoff times move rarely and by minutes; an hour-old schedule is still
 * accurate enough to decide which leagues to look at, and refreshing it more
 * often would spend more than the odds requests it saves.
 */
const FIXTURE_CACHE_MINUTES = 60;

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
  /** Books that actually priced something — the check on a wrong book key. */
  booksSeen: string[];
}

export interface WatchSettings {
  enabled: boolean;
  provider: string;
  pollMinutes: number;
  baselineFromMinutes: number;
  baselineToMinutes: number;
  alertFromMinutes: number;
  alertToMinutes: number;
  bookmakers: string;
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

/**
 * Rundown addresses a sport by a numeric id, not a league key, so its "leagues"
 * are synthesised as `rundown:<id>`. Keeping the same League shape means the
 * fixture cache, the band filter and the settings' league list all work
 * unchanged across both providers.
 */
function rundownLeagues(): League[] {
  return Object.entries(rundownSportIds()).map(([sport, id]) => ({
    sport: sport as PickSport,
    sportKey: `rundown:${id}`,
  }));
}

/** The numeric sport id inside a `rundown:<id>` key, or null if it isn't one. */
function rundownIdFor(sportKey: string): number | null {
  const m = /^rundown:(\d+)$/.exec(sportKey);
  return m ? Number(m[1]) : null;
}

async function resolveLeagues(settings: WatchSettings, now = new Date()): Promise<League[]> {
  const configured = settings.sportKeys
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filter = (all: League[]) =>
    configured.length === 0 ? all : all.filter((l) => configured.includes(l.sportKey));

  // Rundown's sport list is a fixed table rather than something discovered from
  // the API, so there is nothing to cache and nothing to spend finding out.
  if (settings.provider === "rundown") return filter(rundownLeagues());

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
function afford(budget: Budget, markets: number, regions: number, provider = "oddsapi"): boolean {
  // Rundown bills a flat request, whatever it contains. Charging it the Odds
  // API's (markets x regions) would overstate spend threefold and trip the cap
  // for no reason; charging the Odds API a flat 1 would let it run three times
  // over. The unit has to follow the provider.
  const price = provider === "rundown" ? 1 : markets * regions;
  if (budget.spent + price > budget.cap) {
    budget.stopped = `Daily credit cap reached (${budget.cap}).`;
    return false;
  }
  budget.spent += price;
  budget.requests += 1;
  return true;
}

interface FetchResult {
  events: ApiEvent[] | null;
  /** Human-readable reason, surfaced to the panel rather than only the logs. */
  error: string | null;
}

async function fetchOdds(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // A 422 here almost always means a bookmaker key the feed does not know:
      // it rejects the entire request rather than ignoring the unknown name, so
      // one typo silently yields "no games ever" unless it is called out.
      const hint =
        res.status === 422
          ? " — usually an unrecognised bookmaker or market key; check the Books setting"
          : "";
      const reason = `Feed responded ${res.status}${hint}. ${body.slice(0, 200)}`.trim();
      console.error(`Blitz Odds request failed: ${reason}`);
      return { events: null, error: reason };
    }
    const json = await res.json();
    return { events: Array.isArray(json) ? (json as ApiEvent[]) : [json as ApiEvent], error: null };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("Blitz Odds request errored:", reason);
    return { events: null, error: reason };
  }
}

/**
 * Refresh the cached kickoff list for the leagues we watch.
 *
 * Uses the events endpoint, which carries no prices and is billed far below an
 * odds request. This is what lets a poll skip a league entirely: without it,
 * finding out that nothing starts in the next half hour costs exactly as much
 * as a full slate of prices would.
 */
async function refreshFixtures(
  leagues: League[],
  apiKey: string,
  budget: Budget,
  now: Date,
  settings: WatchSettings
): Promise<void> {
  const stale = new Date(now.getTime() - FIXTURE_CACHE_MINUTES * 60_000);

  for (const { sport, sportKey } of leagues) {
    const fresh = await prisma.oddsFixture.findFirst({
      where: { sportKey, refreshedAt: { gte: stale } },
      select: { id: true },
    });
    if (fresh) continue;

    const rundownId = rundownIdFor(sportKey);
    let events: ApiEvent[] | null = null;

    if (rundownId !== null) {
      // Rundown answers a day at a time, and a game 20 minutes away at 23:50
      // UTC belongs to tomorrow — so the horizon may straddle two dates.
      const collected: ApiEvent[] = [];
      for (const date of datesCovering(now, settings.baselineFromMinutes)) {
        if (!afford(budget, 1, 1, settings.provider)) return;
        const day = await fetchRundownDay(rundownId, date, []);
        if (day.events) collected.push(...day.events);
      }
      events = collected;
    } else {
      // The events endpoint carries no markets or regions; bill it as one unit.
      if (!afford(budget, 1, 1, settings.provider)) return;
      events = (await fetchOdds(`${ODDS_API_BASE}/sports/${sportKey}/events?apiKey=${apiKey}`)).events;
    }

    if (!events) continue;

    for (const ev of events) {
      const commenceTime = new Date(ev.commence_time);
      if (Number.isNaN(commenceTime.getTime())) continue;
      const matchup = formatMatchup(sport, ev.away_team ?? "", ev.home_team ?? "");
      await prisma.oddsFixture.upsert({
        where: { eventId: ev.id },
        create: { eventId: ev.id, sportKey, sport, matchup, commenceTime, refreshedAt: now },
        update: { sportKey, sport, matchup, commenceTime, refreshedAt: now },
      });
    }
  }

  // Games that have started are no longer of any use to this tool.
  await prisma.oddsFixture.deleteMany({ where: { commenceTime: { lt: new Date(now.getTime() - 3_600_000) } } });
}

/**
 * Leagues with a kickoff inside one of the two bands — the only ones worth
 * pricing right now.
 *
 * The ranges are matched exactly, not merged into "anything within 30 minutes".
 * A league whose only imminent game is four minutes from kickoff has nothing
 * this tool can use: the alert band has already closed, so the response would be
 * fetched, paid for, and discarded. Excluding it here is the difference between
 * paying for a game once and paying for it through its whole run-in.
 */
async function leaguesWithImminentGames(
  leagues: League[],
  settings: WatchSettings,
  now: Date
): Promise<League[]> {
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  const soon = await prisma.oddsFixture.findMany({
    where: {
      OR: [
        // Baseline band.
        { commenceTime: { gte: at(settings.baselineToMinutes), lte: at(settings.baselineFromMinutes) } },
        // Alert band.
        { commenceTime: { gte: at(settings.alertToMinutes), lte: at(settings.alertFromMinutes) } },
      ],
    },
    select: { sportKey: true },
    distinct: ["sportKey"],
  });

  const keys = new Set(soon.map((f) => f.sportKey));
  return leagues.filter((l) => keys.has(l.sportKey));
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
): { rows: SnapshotRow[]; marketsSeen: Set<string>; booksSeen: Set<string> } {
  const rows: SnapshotRow[] = [];
  const marketsSeen = new Set<string>();
  const booksSeen = new Set<string>();
  const commenceTime = new Date(ev.commence_time);

  for (const book of ev.bookmakers ?? []) {
    for (const market of book.markets ?? []) {
      for (const o of market.outcomes ?? []) {
        if (!validAmerican(o.price)) continue;
        marketsSeen.add(market.key);
        booksSeen.add(book.key);
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
          minutesToStart: minutesToStart(commenceTime, capturedAt),
          capturedAt,
        });
      }
    }
  }
  return { rows, marketsSeen, booksSeen };
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
  minutesToStart: number;
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
  baselineMinutes: number;
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

  for (const ev of events) {
    const left = minutesToStart(ev.commenceTime, now);
    // Only games inside the alert band can raise anything. A game still 25
    // minutes out is being sampled for its baseline, not judged.
    if (!inAlertWindow(left, settings.alertFromMinutes, settings.alertToMinutes)) continue;

    // Everything captured since the baseline window opened. Bounded by the
    // window rather than a fixed lookback so the query cannot drag in prices
    // from hours earlier that this tool has no opinion about.
    const since = new Date(
      ev.commenceTime.getTime() - settings.baselineFromMinutes * 60_000
    );
    const snaps = await prisma.oddsSnapshot.findMany({
      where: { eventId: ev.eventId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });
    if (snaps.length === 0) continue;

    // Group into one history per (line, book).
    const lines = new Map<string, Map<string, BookHistory>>();
    for (const snap of snaps) {
      const lk = lineKey(snap.marketKey, snap.selection, snap.point);
      let books = lines.get(lk);
      if (!books) lines.set(lk, (books = new Map()));
      let hist = books.get(snap.bookmaker);
      if (!hist) books.set(snap.bookmaker, (hist = { bookmaker: snap.bookmaker, prices: [] }));
      hist.prices.push({ price: snap.price, minutesToStart: snap.minutesToStart });
    }

    for (const [lk, books] of lines) {
      const signal = detectDrop([...books.values()], {
        minProbDelta: settings.minProbDelta,
        minBooks: settings.minBooks,
        baselineFrom: settings.baselineFromMinutes,
        baselineTo: settings.baselineToMinutes,
        alertFrom: settings.alertFromMinutes,
        alertTo: settings.alertToMinutes,
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

      // Report the windows that were actually sampled, not the ones configured.
      // A late poll produces a baseline at, say, 34 minutes rather than 30, and
      // saying so is the difference between a checkable claim and a plausible
      // one.
      const baselineMinutes = Math.max(...signal.moves.map((m) => m.fromMinutes));
      const currentMinutes = Math.min(...signal.moves.map((m) => m.toMinutes));

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
        baselineMinutes,
        minutesToStart: currentMinutes,
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
    booksSeen: [],
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
  const booksSeen = new Set<string>();
  const seenEvents = new Map<
    string,
    { eventId: string; sport: PickSport; sportKey: string; matchup: string; commenceTime: Date }
  >();
  let dropsFound = 0;
  let error: string | null = null;

  try {
    const allLeagues = await resolveLeagues(settings);

    // Cheap first: learn which leagues have a kickoff coming, so the expensive
    // requests are only made where there is something to watch.
    await refreshFixtures(allLeagues, apiKey, budget, now, settings);
    const leagues = await leaguesWithImminentGames(allLeagues, settings, now);

    // Both bands, in one shape, so the fetch filter and the detector cannot
    // drift apart.
    const windows = {
      baselineFrom: settings.baselineFromMinutes,
      baselineTo: settings.baselineToMinutes,
      alertFrom: settings.alertFromMinutes,
      alertTo: settings.alertToMinutes,
    };

    const books = settings.bookmakers
      .split(",")
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean);
    // Up to ten named books bill as one region. Naming books rather than a
    // region is also the only way to reach a book like bet365, which does not
    // live in the US region the props endpoint uses.
    const bookParam = books.length > 0 ? `bookmakers=${books.join(",")}` : "regions=us";

    const pending: SnapshotRow[] = [];

    // --- Tier 1: game lines, one bulk request per league --------------------
    if (settings.watchGameLines) {
      const markets = GAME_LINE_MARKETS.map((m) => m.key);
      for (const { sport, sportKey } of leagues) {
        const rundownId = rundownIdFor(sportKey);
        let events: ApiEvent[] | null = null;
        let fetchError: string | null = null;

        if (rundownId !== null) {
          // Books are filtered from the response, not requested — a Rundown
          // request costs the same however many books come back, so narrowing
          // it on the wire would buy nothing and could only lose data.
          const collected: ApiEvent[] = [];
          for (const date of datesCovering(now, settings.baselineFromMinutes)) {
            if (!afford(budget, 1, 1, settings.provider)) break;
            const day = await fetchRundownDay(rundownId, date, books);
            if (day.events) collected.push(...day.events);
            else if (day.error && !fetchError) fetchError = day.error;
          }
          events = collected.length > 0 || !fetchError ? collected : null;
        } else {
          if (!afford(budget, markets.length, 1, settings.provider)) break;
          const res = await fetchOdds(
            `${ODDS_API_BASE}/sports/${sportKey}/odds` +
              `?apiKey=${apiKey}&${bookParam}&oddsFormat=american&markets=${markets.join(",")}`
          );
          events = res.events;
          fetchError = res.error;
        }

        if (!events) {
          // Keep the first reason: a bad book key fails every league
          // identically, and repeating it would bury anything else.
          if (fetchError && !error) error = fetchError;
          continue;
        }

        for (const ev of events) {
          const commenceTime = new Date(ev.commence_time);
          // Only the run-up to kickoff. Everything else is outside this tool's
          // question and would be paid for twice — once to fetch, once to store.
          if (!inWatchWindow(minutesToStart(commenceTime, now), windows)) continue;

          const { rows, marketsSeen: mSeen, booksSeen: bSeen } = snapshotRows(ev, sportKey, now);
          pending.push(...rows);
          for (const k of mSeen) marketsSeen.add(k);
          for (const k of bSeen) booksSeen.add(k);
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
        `?apiKey=${apiKey}&${bookParam}&oddsFormat=american&markets=${markets.map((m) => m.key).join(",")}`;
      const { events } = await fetchOdds(url);
      if (!events) continue;

      for (const raw of events) {
        const { rows, marketsSeen: mSeen, booksSeen: bSeen } = snapshotRows(raw, ev.sportKey, now);
        pending.push(...rows);
        for (const k of mSeen) marketsSeen.add(k);
        for (const k of bSeen) booksSeen.add(k);
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
      booksSeen: [...booksSeen].join(", "),
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
    booksSeen: [...booksSeen],
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
 * Shown in the panel before the switch is thrown, because the way this tool
 * fails quietly is a drained quota, and a number on screen beforehand is the
 * cheapest possible way to avoid that.
 *
 * Two figures, because they differ by an order of magnitude and the difference
 * is the whole point:
 *
 *   busy   — every watched league has a game inside the window at once. The
 *            honest worst case, and what the daily cap has to survive.
 *   quiet  — nothing is starting soon, so only the hourly schedule refresh runs.
 *
 * Real spend sits between them and is dominated by how many leagues are being
 * watched, which is why narrowing the league list is the advice the panel gives.
 */
export async function estimateRunCost(
  settings: WatchSettings
): Promise<{
  leagues: number;
  gameLineCredits: number;
  deepCredits: number;
  perRun: number;
  perDay: number;
  quietPerDay: number;
}> {
  const leagues = await resolveLeagues(settings);
  const rundown = settings.provider === "rundown";

  // Rundown charges a flat request whatever it contains, so a league costs 1
  // regardless of how many markets or books come back — which is why its
  // projection is so much lower for the same coverage.
  const perLeague = rundown ? 1 : GAME_LINE_MARKETS.length;
  const gameLineCredits = settings.watchGameLines ? leagues.length * perLeague : 0;

  // Deep spend is per event and dominated by whichever sport is deepest, so the
  // estimate uses the widest market list any watched league would ask for — an
  // estimate that under-promises is worse than useless here.
  // Rundown has no per-event endpoint in this adapter — its day request already
  // carries every book — so the deep tier simply does not apply to it.
  const widest = rundown
    ? 0
    : leagues.reduce((max, l) => Math.max(max, deepMarketsFor(l.sportKey, settings).length), 0);
  const deepCredits = widest * settings.maxDeepEvents;

  const perRun = gameLineCredits + deepCredits;
  const runsPerDay = settings.pollMinutes > 0 ? Math.floor((24 * 60) / settings.pollMinutes) : 0;

  // The schedule refresh runs at most once an hour per league and is billed as
  // a single unit, so it is the floor on a completely quiet day.
  const refreshesPerDay = leagues.length * Math.floor(24 * (60 / FIXTURE_CACHE_MINUTES));

  return {
    leagues: leagues.length,
    gameLineCredits,
    deepCredits,
    perRun,
    perDay: perRun * runsPerDay + refreshesPerDay,
    quietPerDay: refreshesPerDay,
  };
}
