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

// All sports with odds-feed coverage, shown as homepage tabs. Order doubles
// as tab order (major-4 first).
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
  const events = data
    .filter((e) => new Date(e.commence_time) > new Date())
    .slice(0, 25)
    .map((event) => normalizeEvent(event, sport));

  return { configured: true, supported: true, events };
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
        });
      } else if (market.key === "totals" && outcome.point !== undefined) {
        markets.push({
          betType: "TOTAL",
          selection: `${outcome.name} ${outcome.point}`,
          odds: outcome.price,
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
  };
}
