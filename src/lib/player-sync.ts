import { prisma } from "@/lib/prisma";
import { normalizePlayerName } from "@/lib/player-photos";
import type { PickSport } from "@prisma/client";

/**
 * Filling the Player table from ESPN.
 *
 * Built from team ROSTERS rather than ESPN's athlete lists. The athlete
 * endpoint is a historical archive that has to be filtered on each row's own
 * `active` flag, and it carries no team at all — not on the list and not on a
 * single athlete fetched by id. Rosters give the current squad and the club in
 * one request, which is both more correct and the only way to answer "which of
 * these two teams is he on".
 *
 * Lives here rather than in the script so the two ways of running it — a
 * command line with a database URL, and the admin/cron route — cannot drift
 * apart. The normalization in particular has to be the same function the
 * resolver uses, or names would be written one way and looked up another and
 * every photo would quietly stop appearing.
 */

/** sport -> ESPN's {sport}/{league} path. The sports with usable headshots. */
export const SYNC_LEAGUES: Partial<Record<PickSport, string>> = {
  NFL: "football/nfl",
  NBA: "basketball/nba",
  WNBA: "basketball/wnba",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
};

export type SyncReport = {
  sport: PickSport;
  /** Teams whose rosters were read. */
  teams: number;
  /** Rows now in the table for this sport. */
  written: number;
  /** Names shared by more than one player — these will never show a photo. */
  ambiguous: number;
};

type RosterPlayer = { espnId: string; fullName: string; teamAbbr: string; teamName: string };

/**
 * Every team in a league, as ESPN's site API lists them.
 *
 * This is the same host the board and the settler already call, so it is not a
 * new dependency — just one this file now uses too.
 */
async function fetchTeams(path: string): Promise<{ id: string }[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} teams: HTTP ${res.status}`);
  const body = (await res.json()) as {
    sports?: { leagues?: { teams?: { team?: { id?: string } }[] }[] }[];
  };
  const teams = body.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams.flatMap((t) => (t.team?.id ? [{ id: t.team.id }] : []));
}

/** One team's current squad, with the club attached to every player. */
async function fetchRoster(path: string, teamId: string): Promise<RosterPlayer[]> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${teamId}/roster`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`${path} roster ${teamId}: HTTP ${res.status}`);
  const body = (await res.json()) as {
    team?: { abbreviation?: string; displayName?: string };
    athletes?: ({ id?: string; fullName?: string; displayName?: string } & {
      items?: { id?: string; fullName?: string; displayName?: string }[];
    })[];
  };

  const teamAbbr = body.team?.abbreviation ?? "";
  const teamName = body.team?.displayName ?? "";

  // Most leagues return a flat `athletes` array; the NFL groups them by
  // position into objects carrying their own `items`. Handle both rather than
  // silently syncing an empty NFL.
  const groups = body.athletes ?? [];
  const flat = groups.flatMap((g) => (Array.isArray(g.items) ? g.items : [g]));

  return flat.flatMap((a) => {
    const fullName = a.fullName || a.displayName;
    if (!a.id || !fullName) return [];
    return [{ espnId: String(a.id), fullName, teamAbbr, teamName }];
  });
}

/** Run `work` over `items` with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) out[i] = await work(items[i]);
    })
  );
  return out;
}

export async function syncPlayersForSport(sport: PickSport): Promise<SyncReport> {
  const path = SYNC_LEAGUES[sport];
  if (!path) throw new Error(`${sport} has no ESPN headshot league`);

  const teams = await fetchTeams(path);
  // Bounded concurrency, like the settler's score fetches: 30-odd rosters one
  // at a time does not fit a 60s function, and firing all of them at once is
  // how you find ESPN's rate limit.
  const rosters = await pool(teams, 6, (t) => fetchRoster(path, t.id));

  const seen = new Set<string>();
  const rows = rosters
    .flat()
    .filter((p) => {
      // A player on two rosters (a mid-trade duplicate) would break the unique
      // key; first roster wins.
      if (seen.has(p.espnId)) return false;
      seen.add(p.espnId);
      return true;
    })
    .map((p) => ({
      sport,
      espnId: p.espnId,
      fullName: p.fullName,
      normalizedName: normalizePlayerName(p.fullName),
      teamAbbr: p.teamAbbr || null,
      teamName: p.teamName || null,
      active: true,
    }))
    .filter((r) => r.normalizedName);

  if (rows.length === 0) {
    const existing = await prisma.player.count({ where: { sport } });
    return { sport, teams: teams.length, written: existing, ambiguous: 0 };
  }

  await prisma.$transaction([
    prisma.player.deleteMany({ where: { sport } }),
    prisma.player.createMany({ data: rows, skipDuplicates: true }),
  ]);

  const [written, dupes] = await Promise.all([
    prisma.player.count({ where: { sport } }),
    prisma.player.groupBy({
      by: ["normalizedName"],
      where: { sport },
      _count: { normalizedName: true },
      having: { normalizedName: { _count: { gt: 1 } } },
    }),
  ]);

  return { sport, teams: teams.length, written, ambiguous: dupes.length };
}
