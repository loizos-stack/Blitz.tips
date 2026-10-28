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

/** Sports this fallback covers — exactly those ESPN exposes on one slug. */
export function espnCoveredSports(): PickSport[] {
  return Object.keys(ESPN_PATH) as PickSport[];
}

export function espnCovers(sport: PickSport): boolean {
  return Boolean(ESPN_PATH[sport]);
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
interface EspnPrice {
  /** Sometimes a number, sometimes "-110". */
  american?: string | number;
  value?: number;
  odds?: string | number;
  close?: { odds?: string | number };
  open?: { odds?: string | number };
}
interface EspnTeamOdds {
  favorite?: boolean;
  underdog?: boolean;
  moneyLine?: number;
  spreadOdds?: number;
  team?: EspnTeam;
  close?: { pointSpread?: EspnPrice; moneyLine?: EspnPrice };
}
interface EspnOdds {
  provider?: { name?: string };
  details?: string;
  spread?: number;
  overUnder?: number;
  overOdds?: number;
  underOdds?: number;
  homeTeamOdds?: EspnTeamOdds;
  awayTeamOdds?: EspnTeamOdds;
  current?: {
    over?: EspnPrice;
    under?: EspnPrice;
    total?: EspnPrice;
    spread?: EspnPrice;
    homeFavorite?: boolean;
    awayFavorite?: boolean;
  };
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

const teamName = (t?: EspnTeam): string =>
  t?.displayName || t?.shortDisplayName || t?.abbreviation || "";

/**
 * Which side the spread belongs to.
 *
 * ESPN states the favourite explicitly often enough that guessing is
 * unnecessary, and a spread on the wrong team is the single worst thing this
 * file could output — so when the favourite can't be established, the spread
 * is dropped rather than assumed.
 */
function homeIsFavourite(odds: EspnOdds, homeAbbr: string): boolean | null {
  if (odds.homeTeamOdds?.favorite === true) return true;
  if (odds.awayTeamOdds?.favorite === true) return false;
  if (odds.current?.homeFavorite === true) return true;
  if (odds.current?.awayFavorite === true) return false;
  // "LAL -4.5" — the abbreviation in details names the favourite.
  const detail = odds.details?.trim();
  if (detail && homeAbbr) {
    const named = detail.split(/\s+/)[0]?.toUpperCase();
    if (named && named !== "EVEN") return named === homeAbbr.toUpperCase();
  }
  return null;
}

function buildMarkets(odds: EspnOdds, home: string, away: string, homeAbbr: string): MarketOption[] {
  const out: MarketOption[] = [];

  // ---- moneyline: the one market ESPN prices consistently.
  const homeMl = firstPrice(odds.homeTeamOdds?.moneyLine, odds.homeTeamOdds?.close?.moneyLine?.odds);
  const awayMl = firstPrice(odds.awayTeamOdds?.moneyLine, odds.awayTeamOdds?.close?.moneyLine?.odds);
  if (homeMl !== null && awayMl !== null) {
    out.push({ betType: "MONEYLINE", selection: `${away} ML`, odds: awayMl, marketKey: "h2h", side: away });
    out.push({ betType: "MONEYLINE", selection: `${home} ML`, odds: homeMl, marketKey: "h2h", side: home });
  }

  // ---- spread: only with both a line AND a price, and a known favourite.
  const line = typeof odds.spread === "number" ? Math.abs(odds.spread) : null;
  const fav = homeIsFavourite(odds, homeAbbr);
  const homeSpreadPrice = firstPrice(
    odds.homeTeamOdds?.spreadOdds,
    odds.homeTeamOdds?.close?.pointSpread?.odds,
    odds.homeTeamOdds?.close?.pointSpread?.american
  );
  const awaySpreadPrice = firstPrice(
    odds.awayTeamOdds?.spreadOdds,
    odds.awayTeamOdds?.close?.pointSpread?.odds,
    odds.awayTeamOdds?.close?.pointSpread?.american
  );
  if (line !== null && line > 0 && fav !== null && homeSpreadPrice !== null && awaySpreadPrice !== null) {
    const homePoint = fav ? -line : line;
    const awayPoint = -homePoint;
    const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    out.push({
      betType: "SPREAD", selection: `${away} ${fmt(awayPoint)}`, odds: awaySpreadPrice,
      point: awayPoint, marketKey: "spreads", side: away,
    });
    out.push({
      betType: "SPREAD", selection: `${home} ${fmt(homePoint)}`, odds: homeSpreadPrice,
      point: homePoint, marketKey: "spreads", side: home,
    });
  }

  // ---- total: same rule. ESPN usually gives the number with no price, and a
  // number without a price is not a bet anyone can place.
  const total =
    typeof odds.overUnder === "number"
      ? odds.overUnder
      : typeof odds.current?.total?.value === "number"
        ? odds.current.total.value
        : null;
  const overPrice = firstPrice(odds.overOdds, odds.current?.over?.american, odds.current?.over?.value);
  const underPrice = firstPrice(odds.underOdds, odds.current?.under?.american, odds.current?.under?.value);
  if (total !== null && overPrice !== null && underPrice !== null) {
    out.push({
      betType: "TOTAL", selection: `Over ${total}`, odds: overPrice,
      point: total, marketKey: "totals", side: "Over",
    });
    out.push({
      betType: "TOTAL", selection: `Under ${total}`, odds: underPrice,
      point: total, marketKey: "totals", side: "Under",
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
  const path = ESPN_PATH[sport];
  if (!path) return [];

  let data: { events?: EspnScoreboardEvent[] };
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_BASE}/${path}/scoreboard`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      console.warn(`[espn-odds] ${sport} scoreboard returned ${res.status}`);
      return [];
    }
    data = (await res.json()) as { events?: EspnScoreboardEvent[] };
  } catch (e) {
    console.warn(`[espn-odds] ${sport} scoreboard unreachable:`, e);
    return [];
  }

  const out: UpcomingEvent[] = [];
  for (const ev of data.events ?? []) {
    try {
      const parsed = parseEvent(ev, sport, path);
      if (parsed) out.push(parsed);
    } catch (e) {
      // One malformed game must not take the board down with it. This is an
      // undocumented feed: the shape is whatever ESPN sent today.
      console.warn(`[espn-odds] skipped a ${sport} game:`, e);
    }
  }

  return out.sort(
    (a, b) => new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime()
  );
}

function parseEvent(
  ev: EspnScoreboardEvent | null | undefined,
  sport: PickSport,
  path: string
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
    const markets = odds ? buildMarkets(odds, home, away, homeC?.team?.abbreviation ?? "") : [];
    // No priced market means nothing to show on a card whose whole point is
    // the price.
    if (markets.length === 0) return null;

    const live = ev.status?.type?.state === "in";
    return {
      id: `${ESPN_PREFIX}${ev.id}`,
      sport,
      sportKey: `${ESPN_PREFIX}${path}`,
      matchup: `${away} @ ${home}`,
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
  const path = ESPN_PATH[sport];
  if (!path) return map;

  try {
    const res = await fetch(`${ESPN_SCOREBOARD_BASE}/${path}/scoreboard`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return map;
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
  return map;
}
