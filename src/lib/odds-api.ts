import "server-only";
import type { PickSport } from "@prisma/client";
import { getTeamLogoUrl } from "@/lib/team-logos";

// The Odds API (the-odds-api.com) client.
//
// Quota economics drive the design: the free tier is 500 credits/month and one
// odds request costs (markets × regions) = 3 credits. This is called from both
// the public homepage (high, unauthenticated traffic) and the gated handicapper
// pick form — Next dedupes/caches by fetch URL, so both consumers share one
// cached entry per sport. Only the homepage's currently-selected tab fetches
// eagerly (one sport per page load); the rest are opt-in via tabs, so real
// usage tracks whichever sports actually get clicked, not a flat "all sports"
// cost. Still, worst case matters: with all 8 sports on the homepage getting
// steady traffic, REVALIDATE_SECONDS needs to be long enough that
// 8 sports x (30 days / (REVALIDATE_SECONDS/24h)) x 3 credits stays near
// 500/month. At 12h that worst case is 8 x 60 x 3 = 1,440 credits/month —
// above the free tier if every sport is hit constantly, but real traffic
// concentrates on a few popular sports, so actual usage should land well
// under that ceiling. If it doesn't, either widen this further or upgrade
// the-odds-api.com plan. Missing THE_ODDS_API_KEY degrades to
// { configured: false } everywhere it's used, regardless of this value.
const REVALIDATE_SECONDS = 12 * 60 * 60;

// Live scores are only fetched when a game already in view has started (see
// getUpcomingEvents), so this can afford to be much shorter than
// REVALIDATE_SECONDS without materially affecting the monthly quota.
const SCORES_REVALIDATE_SECONDS = 5 * 60;

// How far back a started game stays eligible for a live/final score before
// it's dropped from the feed entirely — long enough to cover a full game in
// any supported sport plus some delay margin.
const GAME_IN_PROGRESS_WINDOW_MS = 4 * 60 * 60 * 1000;

// Overridable so tests can point at a local mock of the upstream API.
const API_BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

// Sports we can serve from the API; everything else falls back to manual entry.
const SPORT_KEYS: Partial<Record<PickSport, string>> = {
  NFL: "americanfootball_nfl",
  NBA: "basketball_nba",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab",
  SOCCER: "soccer_epl",
  UFC_MMA: "mma_mixed_martial_arts",
};

const PREFERRED_BOOKMAKERS = ["draftkings", "fanduel", "betmgm", "caesars"];

// All sports with odds-feed coverage. Preferred display order (major-4 first)
// when a sport is available; getAvailableHomepageSports() filters this down
// to whichever currently have upcoming games.
export const HOMEPAGE_SPORTS: PickSport[] = [
  "NFL",
  "NBA",
  "MLB",
  "NHL",
  "NCAAF",
  "NCAAB",
  "SOCCER",
  "UFC_MMA",
];

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
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) return [];

  const results = await Promise.all(
    HOMEPAGE_SPORTS.map(async (sport) => {
      const sportKey = SPORT_KEYS[sport];
      if (!sportKey) return null;

      const url = `${API_BASE}/sports/${sportKey}/events?apiKey=${apiKey}`;
      const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
      if (!res.ok) return null;

      const events = (await res.json()) as { commence_time: string }[];
      const hasUpcoming = events.some((e) => new Date(e.commence_time) > new Date());
      return hasUpcoming ? sport : null;
    })
  );

  const available = results.filter((s): s is PickSport => s !== null);
  // Never show an empty tab bar (e.g. every league between seasons at once,
  // or a transient upstream hiccup) — fall back to the full static list.
  return available.length > 0 ? available : HOMEPAGE_SPORTS;
}

interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
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
  betType: "MONEYLINE" | "SPREAD" | "TOTAL";
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

export async function getUpcomingEvents(sport: PickSport): Promise<OddsFeedResult> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) return { configured: false, supported: false, events: [] };

  const sportKey = SPORT_KEYS[sport];
  if (!sportKey) return { configured: true, supported: false, events: [] };

  const url =
    `${API_BASE}/sports/${sportKey}/odds` +
    `?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;

  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) {
    // 401 bad key / 422 out of season / 429 quota — all degrade to an empty feed.
    console.error(`Odds API request failed for ${sportKey}: ${res.status}`);
    return { configured: true, supported: true, events: [] };
  }

  const data = (await res.json()) as OddsApiEvent[];
  // Keep upcoming games plus anything that started recently (still live or
  // just wrapped up) so scores have something to attach to; a stale event
  // from hours ago rolls off on its own since it's excluded here.
  const recentCutoff = new Date(Date.now() - GAME_IN_PROGRESS_WINDOW_MS);
  const events = data
    .filter((e) => new Date(e.commence_time) > recentCutoff)
    .slice(0, 25)
    .map((event) => normalizeEvent(event, sport));

  const hasStarted = events.some((e) => new Date(e.commenceTime) <= new Date());
  if (hasStarted) {
    const scores = await getScores(sportKey, apiKey);
    for (const event of events) {
      event.liveScore = scores.get(event.id) ?? null;
    }
  }

  return { configured: true, supported: true, events };
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

function normalizeEvent(event: OddsApiEvent, sport: PickSport): UpcomingEvent {
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
    matchup: `${event.away_team} @ ${event.home_team}`,
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
