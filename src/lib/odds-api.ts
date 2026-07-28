import "server-only";
import type { PickSport } from "@prisma/client";
import { getTeamLogoUrl } from "@/lib/team-logos";
import { formatMatchup } from "@/lib/utils";
import { sportsDbConfigured, resolveSportsDbLogo, resolveSportsDbLeagueBadge } from "@/lib/sportsdb";
import { soccerBadgeQuery } from "@/lib/soccer-leagues";
import { propMarketKeys, extraMarketKeys, buildGroups, type MarketGroup, type RawMarket } from "@/lib/odds-markets";
import { getLiveGameStates, livePairKey, getUfcFighterSet, fighterKey } from "@/lib/espn-scores";

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
// to that many billed odds calls, on its own longer window. At the current caps
// that worst case is roughly (8 x 30 + 20 x 15) x 3 ≈ 1,620 credits/month if
// literally every tab is viewed every single day; real traffic concentrating on
// a few sports lands well under that. Note this is only the odds spend — live scores
// (SCORES_REVALIDATE_SECONDS) cost more per league on game days, so look there
// first when the quota gets tight, then at MAX_SOCCER_LEAGUES.
// Missing THE_ODDS_API_KEY degrades to { configured: false } everywhere.
const REVALIDATE_SECONDS = 24 * 60 * 60;

// Soccer pays for its own breadth. Every other sport is one billed odds call;
// soccer is one per league, so it alone decides the monthly bill — and the
// arithmetic is a straight trade between how many leagues we carry and how
// often we refresh them:
//
//   leagues x 3 credits x (30 days / cache days)
//   12 leagues @ 24h = 1,080/month     20 leagues @ 48h = 900/month
//
// A wider window buys more competitions for less money. What it costs is
// freshness, and soccer is the sport that can afford it: a 1X2 price moves far
// less over a day than an NFL spread does, and the board is a shop window for
// handicappers' tips rather than a place anyone places a bet. Every other sport
// keeps the 24h window.
const SOCCER_REVALIDATE_SECONDS = 48 * 60 * 60;

// Live scores are only fetched when a game already in view has started (see
// getUpcomingEvents), but each refresh is a billed call, and short windows
// compound fast on game days (a 5-minute window during a 4h slate is ~50
// billed calls). 45 minutes keeps scores reasonably fresh at ~1/22nd the
// cost. This is the dominant per-league cost once soccer fans out across a
// dozen competitions, so it's the first knob to widen if the quota gets tight
// — widening it beats dropping leagues.
const SCORES_REVALIDATE_SECONDS = 45 * 60;

// Soccer scores refresh on a wider window for the same reason as its odds: this
// is billed per league and soccer is a dozen-plus of them. 90 minutes is a full
// match, so a game gets picked up live around half-time and again at full time —
// which is what the board needs it for (a LIVE badge and dropping finished
// games), not a minute-by-minute scoreboard.
const SOCCER_SCORES_REVALIDATE_SECONDS = 90 * 60;

function scoresRevalidateForSport(sport: PickSport): number {
  return sport === "SOCCER" ? SOCCER_SCORES_REVALIDATE_SECONDS : SCORES_REVALIDATE_SECONDS;
}

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
//
// NEXT_PUBLIC_THE_ODDS_API_KEY is deliberately NOT accepted. Next inlines every
// NEXT_PUBLIC_* value into the client bundle, so honouring that name would ship
// a paid, billable API key to every visitor's browser the moment someone set it
// — and it would keep working, so nothing would look wrong.
export function oddsApiKey(): string | undefined {
  const raw =
    process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY ?? process.env.THEODDS_API_KEY;
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
  // Like soccer, tennis is resolved live to whatever tournaments are in season
  // (see getTennisTourKeys); this is only a fallback.
  TENNIS: "tennis_atp_aus_open_singles",
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
  // All three European cups rank together, proper and qualifying. The Europa
  // and Conference Leagues aren't undercards — they're where most of the
  // English, Scottish, Dutch and Scandinavian clubs a bettor follows actually
  // play in Europe, and the Conference League in particular is the only
  // European football some of them ever get.
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_uefa_europa_conference_league",
  // The qualifying rounds are their own keys, and in July/August they're often
  // the only European football being played — which is exactly when they were
  // missing from the board.
  "soccer_uefa_champs_league_qualification",
  "soccer_uefa_europa_league_qualification",
  "soccer_uefa_europa_conference_league_qualification",
  "soccer_uefa_super_cup",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  // Second tier of demand: the biggest non-European leagues and the English
  // second division. These run through the northern-hemisphere off-season
  // (Brazil and Liga MX especially), so they're often the only thing with a
  // full card in June/July.
  "soccer_brazil_campeonato",
  "soccer_mexico_ligamx",
  "soccer_efl_champ",
  "soccer_usa_mls",
  "soccer_netherlands_eredivisie",
  "soccer_portugal_primeira_liga",
  "soccer_argentina_primera_division",
  "soccer_brazil_serie_b",
  "soccer_uefa_european_championship",
  "soccer_conmebol_copa_america",
  "soccer_conmebol_copa_libertadores",
];

// Where a UEFA competition we haven't listed slots in: right behind the
// qualifying rounds above, ahead of the domestic leagues.
const UNLISTED_EUROPEAN_RANK =
  SOCCER_LEAGUE_PRIORITY.indexOf("soccer_uefa_europa_conference_league_qualification") + 0.5;

// Cap on how many soccer leagues we carry at once — the main quota knob for
// soccer. League discovery (/sports) and the tab-availability check (/events)
// are free endpoints, so only the per-league odds and scores calls cost.
//
// Per league, per month, worst case (board viewed every day):
//   odds   ~45  — 3 credits (markets × regions) once per SOCCER_REVALIDATE_SECONDS
//   scores ~350 — 2 credits (daysFrom is billed extra) per
//                 SOCCER_SCORES_REVALIDATE_SECONDS, but only while games run
// so roughly 400/league/month at the ceiling, and far less in practice since
// both only bill on a cache miss caused by a real visitor. Both windows were
// halved when this cap went from 12 to 20, so the ceiling for soccer as a whole
// came down even as the number of competitions went up.
//
// Env-overridable so the cap can be tuned against live usage without a deploy.
// Out-of-range or unparseable values fall back to the default rather than
// blanking soccer or running the quota away.
const DEFAULT_MAX_SOCCER_LEAGUES = 20;
const MAX_SOCCER_LEAGUES = (() => {
  const raw = Number(process.env.MAX_SOCCER_LEAGUES?.trim());
  if (!Number.isInteger(raw) || raw < 1 || raw > 30) return DEFAULT_MAX_SOCCER_LEAGUES;
  return raw;
})();

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
  /** True for futures-style listings (tournament winner), which have no matchup. */
  has_outrights?: boolean;
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
  // A UEFA key we've never seen ranks with the European block rather than in the
  // tail: the qualifying rounds are separate keys that get added, renamed and
  // retired between seasons, and naming them one at a time is how they ended up
  // behind a dozen domestic leagues and off the end of the MAX_SOCCER_LEAGUES
  // cut. Ranking it after the tail wouldn't help — the cut lands well before
  // there — so it has to sit inside the priority block to survive.
  const rank = (key: string): number => {
    const listed = SOCCER_LEAGUE_PRIORITY.indexOf(key);
    if (listed !== -1) return listed;
    if (key.startsWith("soccer_uefa_")) return UNLISTED_EUROPEAN_RANK;
    return Number.MAX_SAFE_INTEGER;
  };
  // Equal ranks keep the upstream's own ordering (Array#sort is stable).
  const ranked = [...active].sort((a, b) => rank(a) - rank(b));
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
  // Tennis: every tour prices the match winner, but game spreads / total games
  // vary by tournament and book. Since an unsupported market 422s the whole
  // board request (both the primary and the regions=us retry carry the same
  // markets param), the board asks for h2h only — guaranteeing tennis shows —
  // and the per-event navigator surfaces whatever else the book actually has.
  TENNIS: true,
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
  if (isMoneylineOnly(sport)) return FIGHT_ODDS_REVALIDATE_SECONDS;
  return sport === "SOCCER" ? SOCCER_REVALIDATE_SECONDS : REVALIDATE_SECONDS;
}

// The upstream sport key(s) backing one of our PickSports. Usually one; soccer
// fans out to several leagues.
const MAX_TENNIS_TOURS = 3;

/**
 * Tennis, like soccer, is a set of seasonal tournaments rather than one league,
 * so resolve it live from the free /sports endpoint: whatever the tier has
 * active in the "Tennis" group, Grand Slams first.
 */
async function getTennisTourKeys(apiKey: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/sports?apiKey=${apiKey}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return [];

  const sports = (await res.json()) as OddsApiSportEntry[];
  const active = sports
    .filter((s) => s.group === "Tennis" && s.active && !s.has_outrights)
    .map((s) => s.key);
  if (active.length === 0) return [];

  // Grand Slams and the tour finals carry the deepest markets, so rank them up.
  const marquee = /aus_open|french_open|wimbledon|us_open|atp_finals|wta_finals/;
  const ranked = [...active.filter((k) => marquee.test(k)), ...active.filter((k) => !marquee.test(k))];
  return ranked.slice(0, MAX_TENNIS_TOURS);
}

async function resolveSportKeys(sport: PickSport, apiKey: string): Promise<string[]> {
  if (sport === "SOCCER") return getSoccerLeagueKeys(apiKey);
  if (sport === "TENNIS") {
    const tours = await getTennisTourKeys(apiKey);
    return tours.length ? tours : [];
  }
  const key = SPORT_KEYS[sport];
  return key ? [key] : [];
}

// How far ahead the "Today's lines" board looks. Kept as a wall-clock window
// rather than a calendar-day check so it behaves consistently for every visitor
// regardless of their timezone. 36h covers tonight plus all of tomorrow from any
// hour of the day — a board called "today's lines" shouldn't be showing Sunday's
// card on Thursday.
const UPCOMING_WINDOW_MS = 36 * 60 * 60 * 1000;

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
      // Fight sports (UFC): the free /events schedule lists bouts weeks before
      // any sportsbook posts a price, and the board only surfaces *priced* UFC
      // bouts (it fetches /odds and cross-checks ESPN's UFC card). Gate the pill
      // on that same board so it never shows with an empty slate. This reuses
      // the board's cached odds response — getAllUpcomingEvents fetches the very
      // same feed — so it adds no billed calls beyond what the board already does.
      if (isMoneylineOnly(sport)) {
        const feed = await getUpcomingEvents(sport, { windowOnly: true });
        const hasPriced = feed.events.some((e) => e.markets.length > 0);
        return { sport, hasSoon: hasPriced, hasUpcoming: hasPriced };
      }

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

  // Prefer sports with a game inside the board's window; if none, fall back to
  // sports with any upcoming game rather than leave the tab bar empty; if truly
  // nothing anywhere, fall back to the full static list. That second fallback
  // can show a pill whose board is empty (the board is window-only, the pill
  // isn't) — a tab bar with a "no games" message beats no tab bar at all.
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
  // Structured form of the same line, kept alongside the display string so a
  // pick can be graded later without re-parsing `selection`. Set for options
  // built from the feed (the board and the per-event navigator).
  /** Upstream market key, e.g. "h2h", "totals_h1", "player_points". */
  marketKey?: string;
  /** Player or team the prop is scoped to, when the market has one. */
  player?: string;
  /** Which side of the line: a team name, or "Over"/"Under"/"Yes"/"No". */
  side?: string;
}

export interface LiveScore {
  homeScore: number;
  awayScore: number;
  completed: boolean;
  // Period + clock for an in-progress game (e.g. "3rd Qtr 5:23", "Top 5th"),
  // sourced from ESPN. Null when unavailable (final games, unmatched, or sports
  // ESPN's scoreboard doesn't cover here).
  detail: string | null;
}

export interface UpcomingEvent {
  id: string;
  // The PickSport this event belongs to — lets a mixed (all-sports) board render
  // each card with its own sport's icon/logos and market layout.
  sport: PickSport;
  // Upstream league key (e.g. "americanfootball_nfl", "soccer_epl") — stored
  // on picks created from the schedule so auto-settlement can look up scores.
  sportKey: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string | null;
  awayTeamLogo: string | null;
  // Competition badge for the league this event belongs to. Only populated for
  // soccer, where the pick forms group games under a country → league heading;
  // every other sport is a single league and needs no badge.
  leagueLogo: string | null;
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

    // Soccer only: one competition badge per league (not per event) for the
    // country → league headings in the pick forms.
    if (sport === "SOCCER" && events.length > 0) {
      const { country, league } = soccerBadgeQuery(sportKey);
      const badge = await resolveSportsDbLeagueBadge(country, league);
      for (const event of events) event.leagueLogo = badge;
    }
  }

  // Scores are billed per league, so only fetch them for this league if one of
  // its games has actually started.
  const now = new Date();
  if (events.some((e) => new Date(e.commenceTime) <= now)) {
    const scores = await getScores(sportKey, apiKey, scoresRevalidateForSport(sport));
    for (const event of events) {
      event.liveScore = scores.get(event.id) ?? null;
    }
  }

  return events;
}

export async function getUpcomingEvents(
  sport: PickSport,
  // The homepage board is a hard window: it promises today's lines, so a game
  // four days out has no business on it even when the sport has nothing sooner.
  // The pick forms are the opposite — a handicapper posting Sunday's NFL card on
  // Wednesday is the normal case — so they take the fallback.
  { windowOnly = false }: { windowOnly?: boolean } = {}
): Promise<OddsFeedResult> {
  const apiKey = oddsApiKey();
  if (!apiKey) return { configured: false, supported: false, events: [] };

  if (!isSportSupported(sport)) return { configured: true, supported: false, events: [] };

  const sportKeys = await resolveSportKeys(sport, apiKey);
  if (sportKeys.length === 0) return { configured: true, supported: true, events: [] };

  // Usually one league; soccer merges several. Fetch in parallel and combine.
  const perLeague = await Promise.all(
    sportKeys.map((key) => fetchLeagueEvents(key, sport, apiKey))
  );
  // A single-league sport gets 25 games; a fanned-out one (soccer) needs enough
  // headroom that the later leagues aren't cut off entirely by a busy weekend in
  // the first — a flat 25 would leave Liga MX invisible behind a full EPL card.
  const cap = sportKeys.length > 1 ? 15 * sportKeys.length : 25;
  const events = perLeague
    .flat()
    // Finished games drop off the board — it shows upcoming and in-progress
    // only. (Scores still power auto-settlement separately.)
    .filter((e) => !e.liveScore?.completed)
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())
    .slice(0, cap);

  // Games inside the window, plus anything currently live — a game in progress
  // kicked off in the past but is exactly what someone is looking for. When the
  // sport has nothing in the window, callers that aren't the board fall back to
  // its next upcoming games rather than showing nothing.
  const now = new Date();
  const windowEvents = events.filter(
    (e) => isWithinUpcomingWindow(new Date(e.commenceTime), now) || Boolean(e.liveScore)
  );
  let finalEvents = windowEvents.length > 0 || windowOnly ? windowEvents : events;

  // UFC-only: The Odds API's MMA feed carries every promotion (UFC, PFL, etc.)
  // with no promotion tag, but the site only surfaces UFC. Cross-reference
  // ESPN's UFC card and keep only bouts where both fighters are on it. If ESPN
  // can't be reached (empty set) we leave the feed untouched rather than blank
  // the board.
  if (sport === "UFC_MMA") {
    const ufc = await getUfcFighterSet();
    if (ufc.size > 0) {
      finalEvents = finalEvents.filter(
        (e) => ufc.has(fighterKey(e.awayTeam)) && ufc.has(fighterKey(e.homeTeam))
      );
    }
  }

  // Fight sports only get moneyline lines close to fight night; drop any bout
  // that has no priced market yet so the board never shows an empty "—/—" row.
  if (isMoneylineOnly(sport)) {
    finalEvents = finalEvents.filter((e) => e.markets.length > 0);
  }

  // For games in progress, enrich the live score with a period/clock detail from
  // ESPN (the Odds API doesn't provide one). One free, cached request per sport,
  // only when something is actually live.
  if (finalEvents.some((e) => e.liveScore && !e.liveScore.completed)) {
    const states = await getLiveGameStates(sport);
    if (states.size > 0) {
      for (const e of finalEvents) {
        if (e.liveScore && !e.liveScore.completed) {
          e.liveScore.detail = states.get(livePairKey(e.awayTeam, e.homeTeam)) ?? null;
        }
      }
    }
  }

  return { configured: true, supported: true, events: finalEvents };
}

/**
 * A single board of the upcoming games across every given sport, merged and
 * sorted by start time — the homepage's default "all sports" view. Reuses each
 * sport's cached feed (getUpcomingEvents), so it adds no extra billed calls
 * beyond what the individual sport tabs already cost.
 */
export async function getAllUpcomingEvents(sports: PickSport[]): Promise<OddsFeedResult> {
  const apiKey = oddsApiKey();
  if (!apiKey) return { configured: false, supported: false, events: [] };
  if (sports.length === 0) return { configured: true, supported: true, events: [] };

  const feeds = await Promise.all(sports.map((s) => getUpcomingEvents(s, { windowOnly: true })));
  const events = feeds
    .flatMap((f) => (f.configured && f.supported ? f.events : []))
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime())
    .slice(0, 16);

  return { configured: true, supported: true, events };
}

interface OddsApiScoreEntry {
  id: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

async function getScores(
  sportKey: string,
  apiKey: string,
  revalidate: number = SCORES_REVALIDATE_SECONDS
): Promise<Map<string, LiveScore>> {
  // daysFrom costs an extra credit per call, but it can't be dropped: without
  // it the upstream returns live and upcoming games only, so a game that just
  // finished comes back with no entry at all — and `completed` is exactly what
  // getUpcomingEvents uses to drop finished games off the board. Removing it
  // would halve the price of this call and leave finished games sitting on the
  // board for up to GAME_IN_PROGRESS_WINDOW_MS. Widen the cache instead.
  const url = `${API_BASE}/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=1`;

  // Live scores need to be fresher than odds, but this is a second billed
  // request only made when a game in view has actually started (see
  // hasStarted above) — most page loads never trigger it, so a short window
  // here doesn't meaningfully add to the monthly quota.
  const res = await fetch(url, { next: { revalidate } });
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
      detail: null,
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
          marketKey: market.key,
          side: outcome.name,
        });
      } else if (market.key === "spreads" && outcome.point !== undefined) {
        markets.push({
          betType: "SPREAD",
          selection: `${outcome.name} ${outcome.point > 0 ? "+" : ""}${outcome.point}`,
          odds: outcome.price,
          point: outcome.point,
          marketKey: market.key,
          side: outcome.name,
        });
      } else if (market.key === "totals" && outcome.point !== undefined) {
        markets.push({
          betType: "TOTAL",
          selection: `${outcome.name} ${outcome.point}`,
          odds: outcome.price,
          point: outcome.point,
          marketKey: market.key,
          side: outcome.name,
        });
      }
    }
  }

  return {
    id: event.id,
    sport,
    sportKey,
    matchup: formatMatchup(sport, event.away_team, event.home_team),
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    homeTeamLogo: getTeamLogoUrl(sport, event.home_team),
    awayTeamLogo: getTeamLogoUrl(sport, event.away_team),
    leagueLogo: null,
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
  const props = propMarketKeys(sportKey);
  const extras = extraMarketKeys(sportKey);
  // Props are offered by US books, so this call uses regions=us rather than the
  // Pinnacle-first bookmaker list the board uses (Pinnacle carries no props).
  const base =
    `${API_BASE}/sports/${sportKey}/events/${eventId}/odds` +
    `?apiKey=${apiKey}&regions=us&oddsFormat=american`;

  // One unknown/unsupported market key 422s the whole request, so degrade in
  // tiers rather than all-or-nothing: everything → drop the alternates/periods
  // → drop the props too → bare game lines. A sport that doesn't carry a period
  // market therefore still shows its props instead of losing them.
  const tiers = [
    [...featuredKeys, ...extras, ...props],
    [...featuredKeys, ...props],
    [...featuredKeys, ...extras],
    featuredKeys,
  ].filter((t, i, all) => t.length > 0 && all.findIndex((x) => x.join() === t.join()) === i);

  let data: EventOddsResponse | null = null;
  for (const markets of tiers) {
    data = await fetchEventOddsJson(`${base}&markets=${markets.join(",")}`);
    if (data) break;
  }
  if (!data) return { configured: true, groups: [], bookmaker: null };

  const bookmakers = data.bookmakers ?? [];
  if (bookmakers.length === 0) return { configured: true, groups: [], bookmaker: null };

  // Pick the book with the widest coverage (most markets), preferring the known
  // US prop books on ties. Order reflects a live survey of what this key
  // actually returns (scripts/survey-bookmaker-markets.mjs): DraftKings leads on
  // distinct markets, FanDuel on sport coverage, then the rest of the regulated
  // US books. Note Caesars' upstream key is "williamhill_us", not "caesars" —
  // the old spelling matched nothing and silently did nothing.
  const preferred = [
    "draftkings",
    "fanduel",
    "betmgm",
    "williamhill_us",
    "hardrockbet",
    "betrivers",
    "fanatics",
    "espnbet",
    "ballybet",
    "betparx",
  ];
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
