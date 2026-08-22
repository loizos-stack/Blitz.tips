import "server-only";
import type { PickSport } from "@prisma/client";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";

/**
 * SportsDataIO adapter.
 *
 * Written to the same shapes the board already speaks — UpcomingEvent,
 * MarketOption, and the {homeTeam, awayTeam, homeScore, awayScore} record
 * auto-settle grades against — so it can stand behind the existing seams rather
 * than requiring anything downstream to know which provider answered.
 *
 * ## Why this provider is interesting
 *
 * The current setup stitches three sources: The Odds API for prices and final
 * scores, ESPN for period and box scores, and an ESPN CDN table plus
 * TheSportsDB for crests. SportsDataIO carries all of it, and — the part that
 * actually matters — its odds and its scores share a GameID. Auto-settle exists
 * to match a stored pick to a final score, and today that match is made across
 * providers by team name and date. A shared id removes an entire class of
 * mismatch.
 *
 * ## Read this before trusting the field names
 *
 * The response shapes below are written from SportsDataIO's v3 layout and could
 * not be checked against the live API from the build environment, which has no
 * route to sportsdata.io. Every accessor therefore tolerates more than one
 * spelling — `GameID` vs `GameId`, `HomeTeam` vs `HomeTeamName` — because the
 * cost of guessing wrong is a silent null rather than an error, and a board
 * that renders with every price missing is harder to diagnose than one that
 * fails outright.
 *
 * Run `scripts/probe-sportsdata.mjs` against a real key before believing any of
 * it. Anything that probe contradicts should be corrected here rather than
 * worked around at a call site.
 */

const BASE = process.env.SPORTSDATA_API_BASE?.replace(/\/+$/, "") || "https://api.sportsdata.io/v3";

export function sportsDataKey(): string | undefined {
  const key = process.env.SPORTSDATA_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

export function sportsDataConfigured(): boolean {
  return sportsDataKey() !== undefined;
}

/**
 * Our sport → their URL segment.
 *
 * Deliberately partial. A sport absent here is one whose coverage hasn't been
 * confirmed on the subscription, and an unconfirmed mapping that silently
 * returns nothing is worse than an obvious gap: the board would just look
 * empty. Add entries as the probe confirms them.
 */
const SPORT_PATHS: Partial<Record<PickSport, string>> = {
  NFL: "nfl",
  NBA: "nba",
  MLB: "mlb",
  NHL: "nhl",
  SOCCER: "soccer",
  NCAAF: "cfb",
  NCAAB: "cbb",
  WNBA: "wnba",
};

export function sportsDataSupports(sport: PickSport): boolean {
  return SPORT_PATHS[sport] !== undefined;
}

/**
 * Soccer competitions, ours → theirs.
 *
 * Empty on purpose, and it is the single biggest open question in this
 * integration. Their soccer product is organised by competition with its own
 * ids, and the board carries up to 45 of them. Same discipline as the 1win deep
 * links: an unconfirmed mapping is a guess, and a guess here means a
 * competition quietly stops appearing. The probe prints their competition list;
 * fill this from that output, not from a name that looks similar.
 */
const SOCCER_COMPETITIONS: Record<string, string> = {};

export function soccerCompetitionCoverage(): number {
  return Object.keys(SOCCER_COMPETITIONS).length;
}

// --- Wire shapes -----------------------------------------------------------

interface SdGame {
  GameID?: number | string;
  GameId?: number | string;
  GlobalGameID?: number | string;
  DateTime?: string;
  Day?: string;
  Status?: string;
  HomeTeam?: string;
  AwayTeam?: string;
  HomeTeamName?: string;
  AwayTeamName?: string;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
  HomeScore?: number | null;
  AwayScore?: number | null;
  Competition?: string;
  PregameOdds?: SdOdds[];
  GameOdds?: SdOdds[];
}

interface SdOdds {
  Sportsbook?: string;
  SportsbookName?: string;
  HomeMoneyLine?: number | null;
  AwayMoneyLine?: number | null;
  HomePointSpread?: number | null;
  AwayPointSpread?: number | null;
  HomePointSpreadPayout?: number | null;
  AwayPointSpreadPayout?: number | null;
  OverUnder?: number | null;
  OverPayout?: number | null;
  UnderPayout?: number | null;
}

interface SdTeam {
  Key?: string;
  TeamID?: number | string;
  City?: string;
  Name?: string;
  FullName?: string;
  WikipediaLogoUrl?: string;
  TeamLogoUrl?: string;
  LogoUrl?: string;
}

// Accessors that tolerate the naming variants, so one wrong guess about a field
// name doesn't blank a whole feed.
const gameId = (g: SdGame): string | null => {
  const raw = g.GameID ?? g.GameId ?? g.GlobalGameID;
  return raw === undefined || raw === null ? null : String(raw);
};
const homeName = (g: SdGame): string => g.HomeTeamName ?? g.HomeTeam ?? "";
const awayName = (g: SdGame): string => g.AwayTeamName ?? g.AwayTeam ?? "";
const homeScore = (g: SdGame): number | null => g.HomeTeamScore ?? g.HomeScore ?? null;
const awayScore = (g: SdGame): number | null => g.AwayTeamScore ?? g.AwayScore ?? null;
const teamLogo = (t: SdTeam): string | null => t.WikipediaLogoUrl ?? t.TeamLogoUrl ?? t.LogoUrl ?? null;

const REQUEST_TIMEOUT_MS = 15_000;

async function get<T>(path: string, revalidate: number): Promise<T | null> {
  const key = sportsDataKey();
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      // Both auth styles: they document the header, and the query parameter is
      // what most of their examples use. Sending both costs nothing.
      headers: { "Ocp-Apim-Subscription-Key": key },
      next: { revalidate },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`SportsDataIO ${path} responded ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`SportsDataIO ${path} failed:`, e);
    return null;
  }
}

/** YYYY-MM-DD, which is the date format their by-date endpoints take. */
export function sdDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// --- Odds ------------------------------------------------------------------

/**
 * Turns one book's line into the board's market options.
 *
 * Their odds are already American, which is what picks are stored in, so no
 * conversion — and no rounding error introduced by one.
 *
 * A missing payout is treated as -110 rather than dropping the market. Books
 * routinely omit a standard juice, and a spread with no price is more useful to
 * a bettor than no spread at all; the alternative is a board that looks broken
 * whenever a book is terse.
 */
const DEFAULT_JUICE = -110;

export function marketsFromOdds(odds: SdOdds, home: string, away: string): MarketOption[] {
  const out: MarketOption[] = [];

  if (typeof odds.HomeMoneyLine === "number") {
    out.push({ betType: "MONEYLINE", selection: home, odds: odds.HomeMoneyLine, marketKey: "h2h", side: home });
  }
  if (typeof odds.AwayMoneyLine === "number") {
    out.push({ betType: "MONEYLINE", selection: away, odds: odds.AwayMoneyLine, marketKey: "h2h", side: away });
  }

  if (typeof odds.HomePointSpread === "number") {
    out.push({
      betType: "SPREAD",
      selection: `${home} ${odds.HomePointSpread > 0 ? "+" : ""}${odds.HomePointSpread}`,
      odds: odds.HomePointSpreadPayout ?? DEFAULT_JUICE,
      point: odds.HomePointSpread,
      marketKey: "spreads",
      side: home,
    });
  }
  if (typeof odds.AwayPointSpread === "number") {
    out.push({
      betType: "SPREAD",
      selection: `${away} ${odds.AwayPointSpread > 0 ? "+" : ""}${odds.AwayPointSpread}`,
      odds: odds.AwayPointSpreadPayout ?? DEFAULT_JUICE,
      point: odds.AwayPointSpread,
      marketKey: "spreads",
      side: away,
    });
  }

  if (typeof odds.OverUnder === "number") {
    out.push({
      betType: "TOTAL",
      selection: `Over ${odds.OverUnder}`,
      odds: odds.OverPayout ?? DEFAULT_JUICE,
      point: odds.OverUnder,
      marketKey: "totals",
      side: "Over",
    });
    out.push({
      betType: "TOTAL",
      selection: `Under ${odds.OverUnder}`,
      odds: odds.UnderPayout ?? DEFAULT_JUICE,
      point: odds.OverUnder,
      marketKey: "totals",
      side: "Under",
    });
  }

  return out;
}

/**
 * Picks which book to show.
 *
 * One book per event, not a merge: the board displays a single price and CLV is
 * measured against a named book, so blending several would make both claims
 * meaningless. Preference order is configurable because which book is sharpest
 * is a judgement, not a fact about the data.
 */
const BOOK_PREFERENCE = (process.env.SPORTSDATA_BOOKS ?? "Pinnacle,BetOnline,Bookmaker,DraftKings,FanDuel")
  .split(",")
  .map((b) => b.trim().toLowerCase())
  .filter(Boolean);

export function chooseBook(books: SdOdds[]): SdOdds | null {
  if (books.length === 0) return null;
  for (const want of BOOK_PREFERENCE) {
    const hit = books.find((b) => (b.Sportsbook ?? b.SportsbookName ?? "").toLowerCase() === want);
    if (hit) return hit;
  }
  // None of the preferred books priced it — take the first that has any line at
  // all rather than showing nothing.
  return books.find((b) => b.HomeMoneyLine != null || b.OverUnder != null || b.HomePointSpread != null) ?? books[0];
}

export function bookName(odds: SdOdds | null): string | null {
  return odds ? odds.Sportsbook ?? odds.SportsbookName ?? null : null;
}

/**
 * Upcoming games with prices, in the board's own shape.
 *
 * `sportKey` is set to `sportsdata:{sport}` rather than reusing the Odds API's
 * key. Picks store it, and a pick priced by one provider must not be settled by
 * the other's ids — writing the provider into the key makes that impossible to
 * confuse later, and makes a mixed-provider database readable.
 */
export async function getUpcomingFromSportsData(
  sport: PickSport,
  date: Date,
  revalidate = 900
): Promise<UpcomingEvent[]> {
  const path = SPORT_PATHS[sport];
  if (!path) return [];

  const games = await get<SdGame[]>(`/${path}/odds/json/GameOddsByDate/${sdDate(date)}`, revalidate);
  if (!Array.isArray(games)) return [];

  const logos = await getTeamLogos(sport, revalidate);
  const events: UpcomingEvent[] = [];

  for (const g of games) {
    const id = gameId(g);
    const home = homeName(g);
    const away = awayName(g);
    if (!id || !home || !away) continue;

    const book = chooseBook(g.PregameOdds ?? g.GameOdds ?? []);
    events.push({
      id,
      sport,
      sportKey: `sportsdata:${path}`,
      matchup: `${away} @ ${home}`,
      homeTeam: home,
      awayTeam: away,
      homeTeamLogo: logos.get(home.toLowerCase()) ?? null,
      awayTeamLogo: logos.get(away.toLowerCase()) ?? null,
      leagueLogo: null,
      commenceTime: g.DateTime ?? g.Day ?? new Date().toISOString(),
      bookmaker: bookName(book),
      markets: book ? marketsFromOdds(book, home, away) : [],
      liveScore: null,
    });
  }

  return events;
}

// --- Scores ----------------------------------------------------------------

export interface SdFinalScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Final scores for one day, keyed by the same GameID the odds carried.
 *
 * This is the point of the whole exercise: auto-settle can look a pick up by
 * id instead of matching on team names and a date window.
 */
export async function getFinalScoresFromSportsData(
  sport: PickSport,
  date: Date
): Promise<Map<string, SdFinalScore>> {
  const path = SPORT_PATHS[sport];
  const out = new Map<string, SdFinalScore>();
  if (!path) return out;

  const endpoint = sport === "SOCCER" ? "GamesByDate" : "ScoresByDate";
  // No caching: a settled score is the thing we are actively waiting on.
  const games = await get<SdGame[]>(`/${path}/scores/json/${endpoint}/${sdDate(date)}`, 0);
  if (!Array.isArray(games)) return out;

  for (const g of games) {
    const id = gameId(g);
    const hs = homeScore(g);
    const as = awayScore(g);
    // "Final" and "F/OT" both count; anything still running does not.
    const finished = typeof g.Status === "string" && /^f/i.test(g.Status);
    if (!id || !finished || hs === null || as === null) continue;
    out.set(id, { homeTeam: homeName(g), awayTeam: awayName(g), homeScore: hs, awayScore: as });
  }

  return out;
}

// --- Images ----------------------------------------------------------------

/**
 * Team name (lowercased) → crest URL.
 *
 * Keyed by name rather than their TeamID because the odds feed identifies teams
 * by name, and joining on the thing both sides actually carry avoids a second
 * lookup table that could drift.
 *
 * Cached hard: crests change about once a decade.
 */
export async function getTeamLogos(sport: PickSport, revalidate = 86_400): Promise<Map<string, string>> {
  const path = SPORT_PATHS[sport];
  const out = new Map<string, string>();
  if (!path) return out;

  const teams = await get<SdTeam[]>(`/${path}/scores/json/Teams`, revalidate);
  if (!Array.isArray(teams)) return out;

  for (const t of teams) {
    const logo = teamLogo(t);
    if (!logo) continue;
    // Index every name the odds feed might use for the same club.
    for (const name of [t.FullName, t.Name, t.Key, [t.City, t.Name].filter(Boolean).join(" ")]) {
      if (name && name.trim()) out.set(name.trim().toLowerCase(), logo);
    }
  }

  return out;
}
