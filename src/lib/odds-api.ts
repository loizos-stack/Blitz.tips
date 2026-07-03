import "server-only";
import type { PickSport } from "@prisma/client";

// The Odds API (the-odds-api.com) client.
//
// Quota economics drive the design: the free tier is 500 credits/month and one
// odds request costs (markets × regions) = 3 credits, so responses are cached
// via Next's data cache for an hour and fetches only happen on demand (when a
// handicapper opens the pick form). Missing THE_ODDS_API_KEY degrades to
// { configured: false } so the manual pick form keeps working without it.

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

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    // 401 bad key / 422 out of season / 429 quota — all degrade to an empty feed.
    console.error(`Odds API request failed for ${sportKey}: ${res.status}`);
    return { configured: true, supported: true, events: [] };
  }

  const data = (await res.json()) as OddsApiEvent[];
  const events = data
    .filter((e) => new Date(e.commence_time) > new Date())
    .slice(0, 25)
    .map(normalizeEvent);

  return { configured: true, supported: true, events };
}

function normalizeEvent(event: OddsApiEvent): UpcomingEvent {
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
    commenceTime: event.commence_time,
    bookmaker: bookmaker?.title ?? null,
    markets,
  };
}
