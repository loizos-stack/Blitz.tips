import "server-only";
import type { PickSport } from "@prisma/client";
import { ESPN_PATH, ESPN_SCOREBOARD_BASE } from "@/lib/espn-scores";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";

/**
 * A free board, for when the paid one isn't there.
 *
 * ESPN's public scoreboard feed — the same keyless endpoint espn-scores.ts
 * already uses for clocks and finals — also carries a betting line per game.
 * It costs nothing and needs no key, so it is what the site falls back to when
 * THE_ODDS_API_KEY is missing, revoked or out of quota: a board with one book's
 * price on it beats a board with nothing on it.
 *
 * Three things it is NOT, and the code below is written around all three:
 *
 *  1. It is one provider's line, not a shopped market. Events from here are
 *     marked `source: "espn"` so the UI can say so.
 *  2. It prices far less than the paid feed. ESPN reliably gives moneylines;
 *     spreads and totals carry a number but often no price. WE NEVER INVENT A
 *     PRICE — a market with no odds attached is dropped, because a site that
 *     sells verified records cannot show a price no book offered.
 *  3. Its ids are not Odds API ids. They are stored prefixed (`espn:`), and
 *     auto-settle, CLV capture and the per-event market navigator each branch
 *     on that prefix. Without it a pick made here would be selected for
 *     settlement, never match, and sit PENDING forever while looking handled.
 */

/** Marks an id or sport key as ESPN's rather than the Odds API's. */
export const ESPN_PREFIX = "espn:";

export function isEspnSourced(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ESPN_PREFIX);
}

/** The bare ESPN id behind a prefixed one. */
export function espnIdOf(value: string): string {
  return value.startsWith(ESPN_PREFIX) ? value.slice(ESPN_PREFIX.length) : value;
}

/**
 * Soccer, which is not one league but many.
 *
 * ESPN gives each competition its own slug, so unlike every other sport this
 * fans out. The order mirrors SOCCER_LEAGUE_PRIORITY in odds-api.ts — the same
 * competitions ranked the same way — and is capped for the same reason: the
 * board shows a day's games, not a directory.
 *
 * Each entry carries the Odds API league key it corresponds to, so an ESPN
 * soccer event still resolves through soccerLeagueMeta() and gets the right
 * country heading and competition badge.
 */
const ESPN_SOCCER_LEAGUES: { path: string; oddsKey: string }[] = [
  { path: "uefa.champions", oddsKey: "soccer_uefa_champs_league" },
  { path: "uefa.europa", oddsKey: "soccer_uefa_europa_league" },
  { path: "uefa.europa.conf", oddsKey: "soccer_uefa_europa_conference_league" },
  { path: "eng.1", oddsKey: "soccer_epl" },
  { path: "esp.1", oddsKey: "soccer_spain_la_liga" },
  { path: "ita.1", oddsKey: "soccer_italy_serie_a" },
  { path: "ger.1", oddsKey: "soccer_germany_bundesliga" },
  { path: "fra.1", oddsKey: "soccer_france_ligue_one" },
  { path: "bra.1", oddsKey: "soccer_brazil_campeonato" },
  { path: "mex.1", oddsKey: "soccer_mexico_ligamx" },
  { path: "eng.2", oddsKey: "soccer_efl_champ" },
  { path: "usa.1", oddsKey: "soccer_usa_mls" },
  { path: "ned.1", oddsKey: "soccer_netherlands_eredivisie" },
  { path: "por.1", oddsKey: "soccer_portugal_primeira_liga" },
  { path: "tur.1", oddsKey: "soccer_turkey_super_league" },
  { path: "arg.1", oddsKey: "soccer_argentina_primera_division" },
];

/** How many soccer competitions the fallback fans out to. Free, but not instant. */
const MAX_ESPN_SOCCER_LEAGUES = (() => {
  const raw = Number(process.env.MAX_ESPN_SOCCER_LEAGUES?.trim());
  return Number.isInteger(raw) && raw >= 1 && raw <= ESPN_SOCCER_LEAGUES.length ? raw : 10;
})();

/** Sports this fallback covers — ESPN's single-slug sports, plus soccer. */
export function espnCoveredSports(): PickSport[] {
  return [...(Object.keys(ESPN_PATH) as PickSport[]), "SOCCER" as PickSport];
}

export function espnCovers(sport: PickSport): boolean {
  return sport === "SOCCER" || Boolean(ESPN_PATH[sport]);
}

/** Every scoreboard slug to read for a sport, with the league key each maps to. */
function slugsFor(sport: PickSport): { path: string; oddsKey: string | null }[] {
  if (sport === "SOCCER") {
    return ESPN_SOCCER_LEAGUES.slice(0, MAX_ESPN_SOCCER_LEAGUES).map((l) => ({
      path: `soccer/${l.path}`,
      oddsKey: l.oddsKey,
    }));
  }
  const path = ESPN_PATH[sport];
  return path ? [{ path, oddsKey: null }] : [];
}

// --------------------------------------------------------------- the shapes
// Only the fields actually read, all optional: this is an undocumented feed and
// anything here can be absent on any given game.

interface EspnTeam {
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logo?: string;
}
/**
 * One side of one market, as ESPN actually returns it.
 *
 * `close` is the current price and `open` is where it started; both carry the
 * price as a signed string ("-135", "+114") and, for spreads and totals, the
 * line alongside it ("-2.5", "o242.5").
 */
interface EspnSide {
  open?: { odds?: string | number; line?: string | number };
  close?: { odds?: string | number; line?: string | number };
}
interface EspnTeamOdds {
  favorite?: boolean;
  underdog?: boolean;
  /** Older/other shapes put a bare moneyline here. Read as a fallback. */
  moneyLine?: number;
  team?: EspnTeam;
}
interface EspnOdds {
  provider?: { name?: string };
  details?: string;
  spread?: number;
  overUnder?: number;
  /** Three-way only. Confirmed live as `{ moneyLine: 295 }`. */
  drawOdds?: { moneyLine?: number } | number;
  /** The markets proper — each side priced, and lines given per side. */
  moneyline?: { home?: EspnSide; away?: EspnSide; draw?: EspnSide };
  pointSpread?: { home?: EspnSide; away?: EspnSide };
  total?: { over?: EspnSide; under?: EspnSide };
  homeTeamOdds?: EspnTeamOdds;
  awayTeamOdds?: EspnTeamOdds;
}
interface EspnCompetitor {
  homeAway?: "home" | "away";
  team?: EspnTeam;
  score?: string | number;
}
interface EspnCompetition {
  competitors?: EspnCompetitor[];
  odds?: EspnOdds[];
}
interface EspnScoreboardEvent {
  id?: string;
  date?: string;
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
  competitions?: EspnCompetition[];
}

// ------------------------------------------------------------------ parsing

/**
 * An American price out of whichever field this response happens to use.
 *
 * Returns null rather than a guess. "+150", 150 and "EVEN" all appear; the
 * last means +100. Anything else is treated as absent, which costs a market
 * and never invents one.
 */
function price(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw !== 0 ? Math.round(raw) : null;
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase();
  if (t === "EVEN" || t === "EV") return 100;
  const n = Number(t.replace(/^\+/, ""));
  return Number.isFinite(n) && n !== 0 ? Math.round(n) : null;
}

function firstPrice(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    const p = price(c);
    if (p !== null) return p;
  }
  return null;
}

/** A side's current price — `close`, falling back to `open` before kickoff. */
function sidePrice(side: EspnSide | undefined): number | null {
  return firstPrice(side?.close?.odds, side?.open?.odds);
}

/**
 * A side's line. "-2.5" for a spread, "o242.5"/"u242.5" for a total — the
 * over/under letter is stripped, leaving the number both sides share.
 */
function sideLine(side: EspnSide | undefined): number | null {
  const raw = side?.close?.line ?? side?.open?.line;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const n = Number(raw.trim().replace(/^[ou]/i, "").replace(/^\+/, ""));
  return Number.isFinite(n) ? n : null;
}

const teamName = (t?: EspnTeam): string =>
  t?.displayName || t?.shortDisplayName || t?.abbreviation || "";

/**
 * The markets, built only from prices ESPN actually published.
 *
 * Written against a live response rather than documentation — the field names
 * below were read off site.api.espn.com from a Vercel sandbox, because an
 * earlier version of this file guessed them (`homeTeamOdds.moneyLine`) and
 * silently produced an empty board: every game was dropped for having no
 * priced market, with nothing in the logs to say why.
 *
 * What ESPN really returns, per competition:
 *
 *   moneyline:   home/away/draw -> close.odds   "-135" "+114" "+295"
 *   pointSpread: home/away      -> close.line + close.odds   "-2.5" "-105"
 *   total:       over/under     -> close.line + close.odds   "o242.5" "-105"
 *
 * The spread line is stated per side, so the favourite never has to be
 * inferred — the old guesswork is gone entirely.
 *
 * `close` is the current price; `open` is the fallback for a market that has
 * not moved yet. A market missing either its line or its price is dropped: a
 * site selling verified records cannot show a price no book offered.
 */
function buildMarkets(
  odds: EspnOdds,
  home: string,
  away: string,
  threeWay: boolean
): MarketOption[] {
  const out: MarketOption[] = [];

  // ---- moneyline
  const homeMl = firstPrice(sidePrice(odds.moneyline?.home), odds.homeTeamOdds?.moneyLine);
  const awayMl = firstPrice(sidePrice(odds.moneyline?.away), odds.awayTeamOdds?.moneyLine);
  // Three-way: two of three prices is not that market. A reader seeing only
  // home and away would take the shorter one for an even-money shot it isn't.
  const drawMl = firstPrice(
    sidePrice(odds.moneyline?.draw),
    typeof odds.drawOdds === "number" ? odds.drawOdds : odds.drawOdds?.moneyLine
  );
  if (homeMl !== null && awayMl !== null && (!threeWay || drawMl !== null)) {
    out.push({ betType: "MONEYLINE", selection: `${away} ML`, odds: awayMl, marketKey: "h2h", side: away });
    if (threeWay && drawMl !== null) {
      // "Draw ML" / side "Draw" — the exact shape the paid feed produces from
      // the Odds API's own h2h outcome, so nothing downstream meets a second
      // convention.
      out.push({ betType: "MONEYLINE", selection: "Draw ML", odds: drawMl, marketKey: "h2h", side: "Draw" });
    }
    out.push({ betType: "MONEYLINE", selection: `${home} ML`, odds: homeMl, marketKey: "h2h", side: home });
  }

  // ---- spread, each side with its own line and price
  const homeSpread = sideLine(odds.pointSpread?.home);
  const awaySpread = sideLine(odds.pointSpread?.away);
  const homeSpreadPrice = sidePrice(odds.pointSpread?.home);
  const awaySpreadPrice = sidePrice(odds.pointSpread?.away);
  if (
    homeSpread !== null && awaySpread !== null &&
    homeSpreadPrice !== null && awaySpreadPrice !== null
  ) {
    const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    out.push({
      betType: "SPREAD", selection: `${away} ${fmt(awaySpread)}`, odds: awaySpreadPrice,
      point: awaySpread, marketKey: "spreads", side: away,
    });
    out.push({
      betType: "SPREAD", selection: `${home} ${fmt(homeSpread)}`, odds: homeSpreadPrice,
      point: homeSpread, marketKey: "spreads", side: home,
    });
  }

  // ---- total
  const overLine = sideLine(odds.total?.over);
  const underLine = sideLine(odds.total?.under);
  const overPrice = sidePrice(odds.total?.over);
  const underPrice = sidePrice(odds.total?.under);
  const line = overLine ?? underLine ?? (typeof odds.overUnder === "number" ? odds.overUnder : null);
  if (line !== null && overPrice !== null && underPrice !== null) {
    out.push({
      betType: "TOTAL", selection: `Over ${line}`, odds: overPrice,
      point: line, marketKey: "totals", side: "Over",
    });
    out.push({
      betType: "TOTAL", selection: `Under ${line}`, odds: underPrice,
      point: line, marketKey: "totals", side: "Under",
    });
  }

  return out;
}

/**
 * Upcoming and in-progress games for one sport, as board events.
 *
 * Best-effort throughout: a malformed game is skipped, a failed request yields
 * an empty list. This is a fallback, and a fallback that throws is worse than
 * no fallback at all.
 */
export async function getEspnUpcomingEvents(sport: PickSport): Promise<UpcomingEvent[]> {
  const slugs = slugsFor(sport);
  if (slugs.length === 0) return [];

  // Soccer fans out to a slug per competition. In parallel, and one failing
  // league never sinks the rest — the same rule the paid feed follows.
  const perSlug = await Promise.all(
    slugs.map(async ({ path, oddsKey }) => {
      let data: { events?: EspnScoreboardEvent[] };
      try {
        const res = await fetch(`${ESPN_SCOREBOARD_BASE}/${path}/scoreboard`, {
          next: { revalidate: 120 },
        });
        if (!res.ok) {
          console.warn(`[espn-odds] ${path} returned ${res.status}`);
          return [];
        }
        data = (await res.json()) as { events?: EspnScoreboardEvent[] };
      } catch (e) {
        console.warn(`[espn-odds] ${path} unreachable:`, e);
        return [];
      }

      const events: UpcomingEvent[] = [];
      for (const ev of data.events ?? []) {
        try {
          const parsed = parseEvent(ev, sport, oddsKey ?? path);
          if (parsed) events.push(parsed);
        } catch (e) {
          // One malformed game must not take the board down with it. This is
          // an undocumented feed: the shape is whatever ESPN sent today.
          console.warn(`[espn-odds] skipped a ${path} game:`, e);
        }
      }
      return events;
    })
  );

  return perSlug
    .flat()
    .sort((a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime());
}

function parseEvent(
  ev: EspnScoreboardEvent | null | undefined,
  sport: PickSport,
  /** The Odds API league key for soccer, the ESPN slug otherwise. */
  leagueKey: string
): UpcomingEvent | null {
  {
    const comp = ev?.competitions?.[0];
    if (!ev?.id || !comp) return null;
    // Finished games are off the board, same rule the paid feed follows.
    if (ev.status?.type?.completed) return null;

    const homeC = comp.competitors?.find((c) => c?.homeAway === "home");
    const awayC = comp.competitors?.find((c) => c?.homeAway === "away");
    const home = teamName(homeC?.team);
    const away = teamName(awayC?.team);
    if (!home || !away) return null;

    const odds = comp.odds?.[0];
    const markets = odds
      ? buildMarkets(odds, home, away, sport === "SOCCER")
      : [];
    // No priced market means nothing to show on a card whose whole point is
    // the price.
    if (markets.length === 0) return null;

    const live = ev.status?.type?.state === "in";
    return {
      id: `${ESPN_PREFIX}${ev.id}`,
      sport,
      sportKey: `${ESPN_PREFIX}${leagueKey}`,
      // Soccer names home first ("A vs B"); everything else is "Away @ Home".
      // Same convention the paid feed uses, so crests and the settler's
      // team-name matching behave identically either side of the fallback.
      matchup: sport === "SOCCER" ? `${home} vs ${away}` : `${away} @ ${home}`,
      homeTeam: home,
      awayTeam: away,
      homeTeamLogo: homeC?.team?.logo ?? null,
      awayTeamLogo: awayC?.team?.logo ?? null,
      leagueLogo: null,
      commenceTime: ev.date ?? new Date().toISOString(),
      bookmaker: odds?.provider?.name ?? "ESPN",
      markets,
      liveScore: live
        ? {
            homeScore: Number(homeC?.score ?? 0),
            awayScore: Number(awayC?.score ?? 0),
            completed: false,
            detail: ev.status?.type?.shortDetail ?? null,
          }
        : null,
      source: "espn",
    };
  }
}

/** A finished ESPN game: the final score, by ESPN event id. */
export interface EspnFinal {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Finals for one sport, keyed by ESPN event id.
 *
 * This is what lets a pick made from an ESPN event be graded. getFinalPeriodScores
 * in espn-scores.ts keys by team-name pair for the Odds API's benefit; a pick
 * sourced from ESPN already carries the exact event id, so it needs no name
 * matching at all.
 */
export async function getEspnFinals(sport: PickSport): Promise<Map<string, EspnFinal>> {
  const map = new Map<string, EspnFinal>();
  // Soccer fans out the same way the board does — a pick from the Eredivisie
  // is only gradable if the Eredivisie slug is among the ones read back.
  for (const { path } of slugsFor(sport)) {
    await collectFinals(path, map);
  }
  return map;
}

async function collectFinals(path: string, map: Map<string, EspnFinal>): Promise<void> {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_BASE}/${path}/scoreboard`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { events?: EspnScoreboardEvent[] };

    for (const ev of data.events ?? []) {
      if (!ev?.id || !ev.status?.type?.completed) continue;
      const comp = ev.competitions?.[0];
      const homeC = comp?.competitors?.find((c) => c?.homeAway === "home");
      const awayC = comp?.competitors?.find((c) => c?.homeAway === "away");
      if (!homeC || !awayC) continue;
      const homeScore = Number(homeC.score);
      const awayScore = Number(awayC.score);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      map.set(ev.id, {
        homeScore,
        awayScore,
        homeTeam: teamName(homeC.team),
        awayTeam: teamName(awayC.team),
      });
    }
  } catch {
    // best-effort: an unreachable ESPN just leaves those picks for manual grading
  }
}
