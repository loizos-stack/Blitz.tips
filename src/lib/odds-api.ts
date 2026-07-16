import "server-only";
import type { PickSport } from "@prisma/client";
import { getTeamLogoUrl } from "@/lib/team-logos";
import { formatMatchup } from "@/lib/utils";
import { sportsDbConfigured, resolveSportsDbLogo } from "@/lib/sportsdb";
import { additionalMarketKeys, buildGroups, type MarketGroup, type RawMarket } from "@/lib/odds-markets";

// The Odds API (the-odds-api.com) client.
//
// Quota economics drive the design: the free tier is 500 credits/month and one
// odds request costs (markets × regions) = 3 credits. This is called from both
// the public homepage (high, unauthenticated traffic) and the gated handicapper
// pick form — Next dedupes/caches by fetch URL, so both consumers share one
// cached entry per sport. Only the homepage's currently-selected tab fetches
// eagerly (one sport per page load); the rest are opt-in via tabs, so real
// usage tracks whichever sports actually get clicked, not a flat "all sports"
// cost — and the homepage no longer fetches odds until a visitor explicitly
// picks a sport tab (see src/app/page.tsx), so idle homepage traffic costs
// nothing. Worst case still matters: with every sport tab getting clicked
// daily, spend is sports x (30 days / (REVALIDATE_SECONDS/24h)) x 3 credits.
// Soccer counts as up to MAX_SOCCER_LEAGUES "sports" here since it fans out
// to that many billed odds calls. At 24h and the current caps that worst case
// is roughly (8 + 2) x 30 x 3 ≈ 900 credits/month if literally every tab is
// viewed every single day; real traffic concentrating on a few sports lands
// well under the free tier's 500/month. If credits still run out, widen this
// further, lower MAX_SOCCER_LEAGUES, or upgrade the the-odds-api.com plan.
// Missing THE_ODDS_API_KEY degrades to { configured: false } everywhere.
const REVALIDATE_SECONDS = 24 * 60 * 60;

// Live scores are only fetched when a game already in view has started (see
// getUpcomingEvents), but each refresh is a billed call, and short windows
// compound fast on game days (a 5-minute window during a 4h slate is ~50
// billed calls). 30 minutes keeps scores reasonably fresh at ~1/15th the
// cost; shorten it only after moving off the free tier.
const SCORES_REVALIDATE_SECONDS = 30 * 60;

// How far back a started game stays eligible for a live/final score before
// it's dropped from the feed entirely — long enough to cover a full game in
// any supported sport plus some delay margin.
const GAME_IN_PROGRESS_WINDOW_MS = 4 * 60 * 60 * 1000;

// Overridable so tests can point at a local mock of the upstream API.
const API_BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

// Read the Odds API key robustly: trims stray whitespace/newlines from a pasted
// value and accepts a couple of common alternate variable names, so a small
// naming/formatting slip in the host env doesn't silently blank the whole feed.
// THE_ODDS_API_KEY is the canonical name.
export function oddsApiKey(): string | undefined {
  const raw =
    process.env.THE_ODDS_API_KEY ??
    process.env.ODDS_API_KEY ??
    process.env.THEODDS_API_KEY ??
    process.env.NEXT_PUBLIC_THE_ODDS_API_KEY;
  const key = raw?.trim();
  return key ? key : undefined;
}

// Sports we can serve from the API; everything else falls back to manual entry.
// SOCCER's value here is only a fallback single league — soccer is normally
// resolved to whatever leagues our tier has in season (see getSoccerLeagueKeys).
const SPORT_KEYS: Partial<Record<PickSport, string>> = {
  NFL: "americanfootball_nfl",
  NBA: "basketball_nba",
  WNBA: "basketball_wnba",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab",
  SOCCER: "soccer_epl",
  UFC_MMA: "mma_mixed_martial_arts",
};

// Soccer is special. Rather than pin to a single league, we pull whichever
// soccer competitions our API tier currently has in season, discovered live
// from the free /sports endpoint. This priority list surfaces the marquee
// competitions first (World Cup and its qualifiers, the continental cups, the
// top-five European leagues, MLS, the Euros/Copa); any other active league the
// tier exposes still appears after these, up to MAX_SOCCER_LEAGUES. Leagues a
// lower tier can't access (e.g. the World Cup on the free plan) simply 401/422
// on their odds call and are skipped — so "whatever the tier allows" falls out
// without us having to know the plan.
const SOCCER_LEAGUE_PRIORITY = [
  "soccer_fifa_world_cup",
  "soccer_fifa_world_cup_qualifiers_europe",
  "soccer_fifa_world_cup_qualifiers_conmebol",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_usa_mls",
  "soccer_uefa_european_championship",
  "soccer_conmebol_copa_america",
];

// Cap on how many soccer leagues we pull odds for at once. Each league is a
// separate billed odds call (markets × regions = 3 credits), so this is the
// main quota knob for soccer — raise it for more breadth, lower it to save
// credits. League discovery (/sports) and the tab-availability check (/events)
// are both free endpoints, so only this odds fan-out costs anything. Held at
// 2 while on the free tier; the priority list still puts the marquee
// competitions first, so these are the two biggest active ones.
const MAX_SOCCER_LEAGUES = 2;

// Books we request and the order we display them, Pinnacle first (the sharp
// reference book, with full spreads/totals incl. soccer). Requested via The
// Odds API's `bookmakers` param (not a region) so Pinnacle — which lives in
// the eu region — is included alongside the US books; up to 10 books count as
// a single region, so this stays at the same 3-credit cost as one region. Keys
// must be valid Odds API bookmaker keys or the whole request is rejected.
const PREFERRED_BOOKMAKERS = ["pinnacle", "draftkings", "fanduel", "betmgm"];
const BOOKMAKERS_PARAM = PREFERRED_BOOKMAKERS.join(",");

// All sports with odds-feed coverage. Preferred display order (major-4 first)
// when a sport is available; getAvailableHomepageSports() filters this down
// to whichever currently have upcoming games.
export const HOMEPAGE_SPORTS: PickSport[] = [
  "NFL",
  "NBA",
  "WNBA",
  "MLB",
  "NHL",
  "NCAAF",
  "NCAAB",
  "SOCCER",
  "UFC_MMA",
];

interface OddsApiSportEntry {
  key: string;
  group: string;
  active: boolean;
}

// Discover the soccer leagues our tier currently has in season. The /sports
// list is a free endpoint (doesn't count against the usage quota), so this is
// cheap; it's cached on the same long window as odds. On failure we degrade to
// the single fallback league so soccer never goes completely dark.
async function getSoccerLeagueKeys(apiKey: string): Promise<string[]> {
  const url = `${API_BASE}/sports?apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) return [SPORT_KEYS.SOCCER!];

  const sports = (await res.json()) as OddsApiSportEntry[];
  const active = new Set(
    sports.filter((s) => s.group === "Soccer" && s.active).map((s) => s.key)
  );
  if (active.size === 0) return [];

  // Marquee competitions first, then any other active league the tier exposes.
  const ranked = [
    ...SOCCER_LEAGUE_PRIORITY.filter((k) => active.has(k)),
    ...[...active].filter((k) => !SOCCER_LEAGUE_PRIORITY.includes(k)),
  ];
  return ranked.slice(0, MAX_SOCCER_LEAGUES);
}

// Fight sports (UFC/MMA) only offer a moneyline — there are no spreads or
// totals on a bout. Requesting spreads/totals for these is wasteful and, if the
// upstream rejects the unsupported markets, would blank the whole board (both
// the primary and the regions=us fallback carry the same markets param). These
// sports also get priced closer to the event, so they use a shorter cache than
// the once-a-day team-sport board.
const MONEYLINE_ONLY_SPORTS: Partial<Record<PickSport, boolean>> = {
  UFC_MMA: true,
};

export function isMoneylineOnly(sport: PickSport): boolean {
  return Boolean(MONEYLINE_ONLY_SPORTS[sport]);
}

function marketsForSport(sport: PickSport): string {
  return isMoneylineOnly(sport) ? "h2h" : "h2h,spreads,totals";
}

// Fight cards price late and shift near the event, and they're infrequent
// (roughly weekly), so refreshing every few hours keeps them current without
// meaningfully denting the quota. Team-sport boards stay on the daily window.
const FIGHT_ODDS_REVALIDATE_SECONDS = 3 * 60 * 60;

function oddsRevalidateForSport(sport: PickSport): number {
  return isMoneylineOnly(sport) ? FIGHT_ODDS_REVALIDATE_SECONDS : REVALIDATE_SECONDS;
}

// The upstream sport key(s) backing one of our PickSports. Usually one; soccer
// fans out to several leagues.
async function resolveSportKeys(sport: PickSport, apiKey: string): Promise<string[]> {
  if (sport === "SOCCER") return getSoccerLeagueKeys(apiKey);
  const key = SPORT_KEYS[sport];
  return key ? [key] : [];
}

// How far ahead the "Today's lines" board looks. Kept as a wall-clock window
// (next 48h) rather than a calendar-day check so it behaves consistently for
// every visitor regardless of their timezone.
const UPCOMING_WINDOW_MS = 48 * 60 * 60 * 1000;

function isWithinUpcomingWindow(commenceTime: Date, now: Date): boolean {
  const ms = commenceTime.getTime() - now.getTime();
  return ms >= 0 && ms <= UPCOMING_WINDOW_MS;
}

// Cheap existence check for the homepage tab bar: The Odds API's bare
// /events endpoint (no regions/markets) lists upcoming events without odds,
// which the-odds-api.com bills far below the full odds+markets call used by
// getUpcomingEvents. This still means one request per sport per cache
// window instead of "only the clicked sport" — 8 sports x REVALIDATE_SECONDS
// windows adds up, so this shares the same long cache window rather than
// its own. If this endpoint's actual per-call cost turns out to be
// non-trivial on your plan, either drop back to a static tab list
// (HOMEPAGE_SPORTS) or raise REVALIDATE_SECONDS further.
export async function getAvailableHomepageSports(): Promise<PickSport[]> {
  const apiKey = oddsApiKey();
  if (!apiKey) return [];

  const now = new Date();
  const results = await Promise.all(
    HOMEPAGE_SPORTS.map(async (sport) => {
      const sportKeys = await resolveSportKeys(sport, apiKey);
      if (sportKeys.length === 0) return { sport, hasSoon: false, hasUpcoming: false };

      // Check each backing league (usually one) via the free /events endpoint.
      const perKey = await Promise.all(
        sportKeys.map(async (sportKey) => {
          const url = `${API_BASE}/sports/${sportKey}/events?apiKey=${apiKey}`;
          const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
          if (!res.ok) return { hasSoon: false, hasUpcoming: false };

          const events = (await res.json()) as { commence_time: string }[];
          return {
            hasSoon: events.some((e) => isWithinUpcomingWindow(new Date(e.commence_time), now)),
            hasUpcoming: events.some((e) => new Date(e.commence_time) > now),
          };
        })
      );

      return {
        sport,
        hasSoon: perKey.some((r) => r.hasSoon),
        hasUpcoming: perKey.some((r) => r.hasUpcoming),
      };
    })
  );

  // Prefer sports with a game in the next 48h; if none, fall back to sports
  // with any upcoming game rather than leave the tab bar empty; if truly
  // nothing anywhere, fall back to the full static list.
  const soonSports = results.filter((r) => r.hasSoon).map((r) => r.sport);
  if (soonSports.length > 0) return soonSports;

  const upcomingSports = results.filter((r) => r.hasUpcoming).map((r) => r.sport);
  return upcomingSports.length > 0 ? upcomingSports : HOMEPAGE_SPORTS;
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
  // Present on prop markets — the player (or team) the line is for.
  description?: string;
}

interface OddsApiMarket {
  key: "h2h" | "spreads" | "totals";
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface MarketOption {
  betType: "MONEYLINE" | "SPREAD" | "TOTAL" | "PROP";
  selection: string;
  odds: number;
  point?: number;
}

export interface LiveScore {
  homeScore: number;
  awayScore: number;
  completed: boolean;
}

export interface UpcomingEvent {
  id: string;
  // Upstream league key (e.g. "americanfootball_nfl", "soccer_epl") — stored
  // on picks created from the schedule so auto-settlement can look up scores.
  sportKey: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  commenceTime: string;
  bookmaker: string | null;
  markets: MarketOption[];
  liveScore: LiveScore | null;
}

export type OddsFeedResult =
  | { configured: false; supported: false; events: [] }
  | { configured: true; supported: false; events: [] }
  | { configured: true; supported: true; events: UpcomingEvent[] };

export function isSportSupported(sport: PickSport): boolean {
  return sport in SPORT_KEYS;
}

// Fetch and normalize the odds feed for a single upstream league key,
// attaching live/final scores when a game in view has already started. A
// failed request (bad key / out of season / quota / tier-gated league)
// degrades to an empty list so one bad league never sinks the whole feed.
async function fetchLeagueEvents(
  sportKey: string,
  sport: PickSport,
  apiKey: string
): Promise<UpcomingEvent[]> {
  const revalidate = oddsRevalidateForSport(sport);
  const base =
    `${API_BASE}/sports/${sportKey}/odds` +
    `?apiKey=${apiKey}&markets=${marketsForSport(sport)}&oddsFormat=american`;

  // Prefer specific books (Pinnacle first). If the bookmakers list is rejected
  // for any reason, fall back to the plain US region so a bad key never blanks
  // the board.
  let res = await fetch(`${base}&bookmakers=${BOOKMAKERS_PARAM}`, {
    next: { revalidate },
  });
  if (!res.ok) {
    console.error(
      `Odds API bookmakers request failed for ${sportKey}: ${res.status}; retrying with regions=us`
    );
    res = await fetch(`${base}&regions=us`, { next: { revalidate } });
  }
  if (!res.ok) {
    console.error(`Odds API request failed for ${sportKey}: ${res.status}`);
    return [];
  }

  const data = (await res.json()) as OddsApiEvent[];
  // Keep upcoming games plus anything that started recently (still live or
  // just wrapped up) so scores have something to attach to; a stale event
  // from hours ago rolls off on its own since it's excluded here.
  const recentCutoff = new Date(Date.now() - GAME_IN_PROGRESS_WINDOW_MS);
  const events = data
    .filter((e) => new Date(e.commence_time) > recentCutoff)
    .slice(0, 25)
    .map((event) => normalizeEvent(event, sport, sportKey));

  // Backfill crests the static ESPN table can't resolve (soccer, college, and
  // the individual sports) from TheSportsDB. Only touches sides that came back
  // null, and each lookup degrades to null on any failure — so this never
  // blocks or breaks the board, just enriches it when a badge is found.
  if (sportsDbConfigured()) {
    await Promise.all(
      events.map(async (event) => {
        if (event.awayTeamLogo == null) {
          event.awayTeamLogo = await resolveSportsDbLogo(sport, event.awayTeam);
        }
        if (event.homeTeamLogo == null) {
          event.homeTeamLogo = await resolveSportsDbLogo(sport, event.homeTeam);
        }
      })
    );
  }

  // Scores are billed per league, so only fetch them for this league if one of
  // its games has actually started.
  const now = new Date();
  if (events.some((e) => new Date(e.commenceTime) <= now)) {
    const scores = await getScores(sportKey, apiKey);
    for (const event of events) {
      event.liveScore = scores.get(event.id) ?? null;
    }
  }

  return events;
}

export async function getUpcomingEvents(sport: PickSport): Promise<OddsFeedResult> {
  const apiKey = oddsApiKey();
  if (!apiKey) return { configured: false, supported: false, events: [] };

  if (!isSportSupported(sport)) return { configured: true, supported: false, events: [] };

  const sportKeys = await resolveSportKeys(sport, apiKey);
  if (sportKeys.length === 0) return { configured: true, supported: true, events: [] };

  // Usually one league; soccer merges several. Fetch in parallel and combine.
  const perLeague = await Promise.all(
    sportKeys.map((key) => fetchLeagueEvents(key, sport, apiKey))
  );
  const events = perLeague
    .flat()
    // Finished games drop off the board — it shows upcoming and in-progress
    // only. (Scores still power auto-settlement separately.)
    .filter((e) => !e.liveScore?.completed)
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())
    .slice(0, 25);

  // Prefer games in the next 48h (plus anything live); if this sport has nothing
  // in that window, fall back to its next upcoming games rather than showing
  // nothing.
  const now = new Date();
  const windowEvents = events.filter(
    (e) => isWithinUpcomingWindow(new Date(e.commenceTime), now) || Boolean(e.liveScore)
  );
  const finalEvents = windowEvents.length > 0 ? windowEvents : events;

  return { configured: true, supported: true, events: finalEvents };
}

interface OddsApiScoreEntry {
  id: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

async function getScores(sportKey: string, apiKey: string): Promise<Map<string, LiveScore>> {
  const url = `${API_BASE}/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=1`;

  // Live scores need to be fresher than odds, but this is a second billed
  // request only made when a game in view has actually started (see
  // hasStarted above) — most page loads never trigger it, so a short window
  // here doesn't meaningfully add to the monthly quota.
  const res = await fetch(url, { next: { revalidate: SCORES_REVALIDATE_SECONDS } });
  if (!res.ok) {
    console.error(`Odds API scores request failed for ${sportKey}: ${res.status}`);
    return new Map();
  }

  const data = (await res.json()) as OddsApiScoreEntry[];
  const map = new Map<string, LiveScore>();

  for (const entry of data) {
    if (!entry.scores) continue;
    const home = entry.scores.find((s) => s.name === entry.home_team);
    const away = entry.scores.find((s) => s.name === entry.away_team);
    if (!home || !away) continue;
    map.set(entry.id, {
      homeScore: Number(home.score),
      awayScore: Number(away.score),
      completed: entry.completed,
    });
  }

  return map;
}

function normalizeEvent(event: OddsApiEvent, sport: PickSport, sportKey: string): UpcomingEvent {
  const bookmaker =
    PREFERRED_BOOKMAKERS.map((key) => event.bookmakers.find((b) => b.key === key)).find(Boolean) ??
    event.bookmakers[0] ??
    null;

  const markets: MarketOption[] = [];

  for (const market of bookmaker?.markets ?? []) {
    for (const outcome of market.outcomes) {
      if (market.key === "h2h") {
        markets.push({
          betType: "MONEYLINE",
          selection: `${outcome.name} ML`,
          odds: outcome.price,
        });
      } else if (market.key === "spreads" && outcome.point !== undefined) {
        markets.push({
          betType: "SPREAD",
          selection: `${outcome.name} ${outcome.point > 0 ? "+" : ""}${outcome.point}`,
          odds: outcome.price,
          point: outcome.point,
        });
      } else if (market.key === "totals" && outcome.point !== undefined) {
        markets.push({
          betType: "TOTAL",
          selection: `${outcome.name} ${outcome.point}`,
          odds: outcome.price,
          point: outcome.point,
        });
      }
    }
  }

  return {
    id: event.id,
    sportKey,
    matchup: formatMatchup(sport, event.away_team, event.home_team),
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    homeTeamLogo: getTeamLogoUrl(sport, event.home_team),
    awayTeamLogo: getTeamLogoUrl(sport, event.away_team),
    commenceTime: event.commence_time,
    bookmaker: bookmaker?.title ?? null,
    markets,
    liveScore: null,
  };
}

// The full market set for a single event — game lines plus player props (US
// sports) or non-player extras (soccer), grouped into categories. Fetched
// on-demand when a handicapper opens a game (the bulk board only carries game
// lines), so props are billed only for games someone actually looks at. Cached
// briefly so re-opening / re-rendering the same game doesn't re-bill.
const EVENT_MARKETS_REVALIDATE_SECONDS = 5 * 60;

export interface EventMarketsResult {
  configured: boolean;
  groups: MarketGroup[];
  bookmaker: string | null;
}

interface EventOddsResponse {
  bookmakers?: { key: string; title: string; markets: RawMarket[] }[];
}

async function fetchEventOddsJson(url: string): Promise<EventOddsResponse | null> {
  const res = await fetch(url, { next: { revalidate: EVENT_MARKETS_REVALIDATE_SECONDS } });
  if (!res.ok) {
    console.error(`Odds API event markets request failed: ${res.status}`);
    return null;
  }
  return (await res.json()) as EventOddsResponse;
}

export async function getEventMarkets(
  sport: PickSport,
  sportKey: string,
  eventId: string
): Promise<EventMarketsResult> {
  const apiKey = oddsApiKey();
  if (!apiKey) return { configured: false, groups: [], bookmaker: null };

  const featuredKeys = isMoneylineOnly(sport) ? ["h2h"] : ["h2h", "spreads", "totals"];
  const wanted = [...featuredKeys, ...additionalMarketKeys(sportKey)];
  // Props are offered by US books, so this call uses regions=us rather than the
  // Pinnacle-first bookmaker list the board uses (Pinnacle carries no props).
  const base =
    `${API_BASE}/sports/${sportKey}/events/${eventId}/odds` +
    `?apiKey=${apiKey}&regions=us&oddsFormat=american`;

  // One unknown/unsupported market key 422s the whole request, so if the full
  // set fails, fall back to just the game lines — the game still shows odds.
  let data = await fetchEventOddsJson(`${base}&markets=${wanted.join(",")}`);
  if (!data) data = await fetchEventOddsJson(`${base}&markets=${featuredKeys.join(",")}`);
  if (!data) return { configured: true, groups: [], bookmaker: null };

  const bookmakers = data.bookmakers ?? [];
  if (bookmakers.length === 0) return { configured: true, groups: [], bookmaker: null };

  // Pick the book with the widest coverage (most markets), preferring the known
  // US prop books on ties.
  const preferred = ["draftkings", "fanduel", "betmgm", "caesars"];
  const rank = (k: string) => {
    const i = preferred.indexOf(k);
    return i === -1 ? preferred.length : i;
  };
  const chosen = [...bookmakers].sort(
    (a, b) => b.markets.length - a.markets.length || rank(a.key) - rank(b.key)
  )[0];

  return {
    configured: true,
    groups: buildGroups(sportKey, chosen.markets),
    bookmaker: chosen.title,
  };
}
