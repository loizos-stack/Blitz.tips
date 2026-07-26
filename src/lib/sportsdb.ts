import "server-only";
import type { PickSport } from "@prisma/client";
import { getTeamLogoUrl } from "@/lib/team-logos";

// TheSportsDB (thesportsdb.com) logo/badge resolver. The Odds API hands us only
// team/fighter names, and TheSportsDB is searchable by name — so it fills the
// gaps our static ESPN table can't cover: soccer clubs, college teams, and the
// individual sports (UFC/MMA, tennis, golf) where crests are athlete images.
//
// This is a best-effort enrichment: every lookup degrades to null (→ sport icon
// via TeamLogo) on a miss, a bad key, a rate-limit, or an unreachable host, so
// nothing here can break a board render. Results are cached hard (badges rarely
// change) via Next's data cache keyed on the request URL, so a given team is
// only fetched once per revalidate window regardless of how many cards show it.

const DEFAULT_BASE = "https://www.thesportsdb.com/api/v1/json";

// Badges effectively never change; cache for a week and let the occasional
// stale badge ride rather than re-querying on every board render.
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60;

function apiKey(): string | undefined {
  const raw = process.env.SPORTSDB_API_KEY ?? process.env.THESPORTSDB_API_KEY;
  const key = raw?.trim();
  return key ? key : undefined;
}

export function sportsDbConfigured(): boolean {
  return Boolean(apiKey());
}

// Sports whose "teams" are really individuals — resolved via the player search
// (an athlete image) rather than a club badge.
const INDIVIDUAL_SPORTS = new Set<PickSport>(["UFC_MMA", "TENNIS", "GOLF"]);

// Our PickSport → TheSportsDB `strSport` label, used to prefer the right result
// when a name is shared across sports (e.g. a club and a fighter). A sport with
// no confident mapping just takes the first result.
const SPORTSDB_SPORT_LABEL: Partial<Record<PickSport, string>> = {
  SOCCER: "Soccer",
  NCAAF: "American Football",
  NCAAB: "Basketball",
  UFC_MMA: "Fighting",
  TENNIS: "Tennis",
  GOLF: "Golf",
};

interface SportsDbTeam {
  strTeam?: string;
  strSport?: string;
  strBadge?: string;
  strTeamBadge?: string;
}

interface SportsDbPlayer {
  strPlayer?: string;
  strSport?: string;
  strThumb?: string;
  strCutout?: string;
  strRender?: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Network/DNS/host-blocked — degrade silently to the sport-icon fallback.
    return null;
  }
}

// Prefer a result whose sport matches; otherwise fall back to the first one.
function pickBySport<T extends { strSport?: string }>(items: T[], wanted?: string): T | undefined {
  if (items.length === 0) return undefined;
  if (!wanted) return items[0];
  return items.find((i) => i.strSport?.toLowerCase() === wanted.toLowerCase()) ?? items[0];
}

/**
 * Resolve a crest/badge (team sports) or athlete image (individual sports) for
 * a team/fighter name via TheSportsDB. Returns null when unconfigured or on any
 * miss/failure so callers can fall back to the sport icon.
 */
export async function resolveSportsDbLogo(sport: PickSport, name: string): Promise<string | null> {
  const key = apiKey();
  const query = name.trim();
  if (!key || !query) return null;

  const base = process.env.SPORTSDB_API_BASE?.trim() || DEFAULT_BASE;
  const wanted = SPORTSDB_SPORT_LABEL[sport];
  const encoded = encodeURIComponent(query);

  if (INDIVIDUAL_SPORTS.has(sport)) {
    const data = await fetchJson<{ player: SportsDbPlayer[] | null }>(
      `${base}/${key}/searchplayers.php?p=${encoded}`
    );
    const player = pickBySport(data?.player ?? [], wanted);
    // A square thumb reads best in the small circle; fall back to the cutout.
    return player?.strThumb || player?.strCutout || player?.strRender || null;
  }

  const data = await fetchJson<{ teams: SportsDbTeam[] | null }>(
    `${base}/${key}/searchteams.php?t=${encoded}`
  );
  const team = pickBySport(data?.teams ?? [], wanted);
  return team?.strBadge || team?.strTeamBadge || null;
}

interface SportsDbLeague {
  strLeague?: string;
  strLeagueAlternate?: string;
  strSport?: string;
  strBadge?: string;
  strLogo?: string;
}

// Strip everything but letters and digits, and fold accents, so our own league
// labels ("LaLiga", "Série A") can be matched against TheSportsDB's ("Spanish
// La Liga", "Brazilian Serie A") without a hand-maintained alias table.
function normalizeLeagueName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a competition badge by country + league name.
 *
 * We search by country rather than looking up a hardcoded TheSportsDB league id
 * because a wrong id silently shows the wrong competition's badge, which is
 * worse than showing none. Matching is containment on the normalized name, and
 * where several candidates contain ours we take the shortest — that's what
 * keeps "LaLiga" off "Spanish La Liga 2".
 *
 * Returns null when unconfigured or on any miss/failure.
 */
export async function resolveSportsDbLeagueBadge(
  country: string,
  league: string
): Promise<string | null> {
  const key = apiKey();
  if (!key || !country || !league) return null;

  const base = process.env.SPORTSDB_API_BASE?.trim() || DEFAULT_BASE;
  const data = await fetchJson<{ countries: SportsDbLeague[] | null }>(
    `${base}/${key}/search_all_leagues.php?c=${encodeURIComponent(country)}&s=Soccer`
  );

  const wanted = normalizeLeagueName(league);
  if (!wanted) return null;

  const match = (data?.countries ?? [])
    .filter((l) => {
      const name = normalizeLeagueName(l.strLeague ?? "");
      const alt = normalizeLeagueName(l.strLeagueAlternate ?? "");
      return name.includes(wanted) || (alt.length > 0 && alt.includes(wanted));
    })
    .sort(
      (a, b) => (a.strLeague ?? "").length - (b.strLeague ?? "").length
    )[0];

  return match?.strBadge || match?.strLogo || null;
}

/**
 * Resolve a crest for a team/fighter name, preferring the free/instant ESPN
 * table (US major leagues) and falling back to TheSportsDB for everything else.
 * Returns null when nothing resolves so callers can show the sport icon.
 */
export async function resolveTeamLogo(sport: PickSport, name: string): Promise<string | null> {
  const espn = getTeamLogoUrl(sport, name);
  if (espn) return espn;
  return resolveSportsDbLogo(sport, name);
}
