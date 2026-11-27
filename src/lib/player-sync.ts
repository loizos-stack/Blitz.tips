import { prisma } from "@/lib/prisma";
import { normalizePlayerName } from "@/lib/player-photos";
import { resolvePlayer } from "@/lib/player-lookup";
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
  /** Existing picks that gained a photo from this sync. */
  backfilled: number;
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
    return { sport, teams: teams.length, written: existing, ambiguous: 0, backfilled: 0 };
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

  const backfilled = await backfillPickPlayers(sport);

  return { sport, teams: teams.length, written, ambiguous: dupes.length, backfilled };
}

/**
 * Give already-posted picks the photo they could not get at the time.
 *
 * A pick resolves its player once, when it is written. Anything posted before
 * this league was first synced therefore has a playerName and no id — frozen
 * that way forever, which is wrong when the only reason it failed was that the
 * table was empty. The same applies after a roster sync adds a rookie.
 *
 * Only ever fills in blanks: picks that already resolved keep what they were
 * written with, because a trade should not rewrite a published pick's team.
 * That is also what makes this safe to run on every sync.
 *
 * Resolution is per distinct NAME rather than per pick — ten picks on the same
 * player are one lookup and one update, not twenty queries.
 */
export async function backfillPickPlayers(sport: PickSport): Promise<number> {
  // Keyed on the photo, not the ESPN id: a soccer player resolved through
  // TheSportsDB has a photo and no id, and looking for a missing id would
  // retry them forever.
  const pending = await prisma.pick.findMany({
    where: { sport, playerPhotoUrl: null, playerName: { not: null } },
    select: { playerName: true },
    distinct: ["playerName"],
  });

  let filled = 0;
  for (const { playerName } of pending) {
    if (!playerName) continue;

    // The same resolver the write path uses, so a backfilled pick and a freshly
    // posted one cannot disagree about who a name belongs to.
    const resolved = await resolvePlayer(sport, playerName);
    if (!resolved) continue;

    const { count } = await prisma.pick.updateMany({
      where: { sport, playerName, playerPhotoUrl: null },
      data: {
        playerEspnId: resolved.espnId,
        playerPhotoUrl: resolved.photoUrl,
        playerTeam: resolved.team,
      },
    });
    filled += count;
  }

  return filled;
}


export type RefreshReport = {
  /** Distinct player names not yet on a cut-out portrait. */
  scanned: number;
  /** Picks whose photo this run changed. */
  updated: number;
  /** Names left for a follow-up run, because this one hit its cap. */
  remaining: number;
};

/**
 * How many names one invocation will re-resolve.
 *
 * The route has a 60s budget and each name is one TheSportsDB search with a
 * 3s timeout, so this leaves room to spare even if every call is slow.
 * `remaining` says plainly when a follow-up run is needed rather than leaving
 * the caller to guess from a count.
 */
const REFRESH_LIMIT = 40;

/**
 * Move already-posted picks onto cut-out portraits where one now exists.
 *
 * These picks are not broken — they have a photo, and the ordinary backfill
 * only fills blanks, so nothing else would ever revisit them. What changed is
 * the preference: resolvePlayer now ranks a TheSportsDB cutout above ESPN's
 * padded portrait, and above TheSportsDB's own match photos, and this applies
 * that ranking to what is already stored.
 *
 * Every pick with a player name is a candidate, not just the ones with an
 * obviously stale photo. Filtering on the photo URL missed the case that
 * prompted this: a pick already holding the right cut-out but still showing
 * "CHI" where the club is now written out as "Chicago Bears". Resolving is
 * cheap, the write is skipped when nothing differs, and the cap bounds the
 * work either way.
 *
 * Idempotent, and safe to run repeatedly. A player with no cutout re-resolves
 * to exactly the photo already stored, so the write is skipped and nothing
 * churns. Those names do stay in the candidate set and get re-checked on every
 * run, which is the point: TheSportsDB is community-maintained, so a cutout
 * added next month is picked up by the next run rather than needing anyone to
 * notice. Sampling found roughly a third of players have no cutout, so expect
 * `scanned` to stay above zero permanently while `updated` settles at zero.
 *
 * Newest picks first, so when the cap bites it is the cards most likely to be
 * on screen that are fixed first.
 */
export async function refreshPlayerPhotos(): Promise<RefreshReport> {
  const pending = await prisma.pick.findMany({
    where: { playerName: { not: null } },
    select: { sport: true, playerName: true, playerPhotoUrl: true, playerTeam: true },
    distinct: ["sport", "playerName"],
    orderBy: { createdAt: "desc" },
  });

  const batch = pending.slice(0, REFRESH_LIMIT);
  let updated = 0;

  for (const { sport, playerName, playerPhotoUrl, playerTeam } of batch) {
    if (!playerName) continue;

    const resolved = await resolvePlayer(sport, playerName);
    if (!resolved) continue;

    // Write only on a real difference. A player with no cutout resolves to the
    // photo already stored and is left alone, so re-running churns nothing.
    const samePhoto = resolved.photoUrl === playerPhotoUrl;
    const sameTeam = (resolved.team ?? null) === (playerTeam ?? null);
    if (samePhoto && sameTeam) continue;

    const { count } = await prisma.pick.updateMany({
      // Scoped to the values this row had when it was read, so a pick an admin
      // corrected while this was running keeps the correction.
      where: { sport, playerName, playerPhotoUrl, playerTeam },
      data: {
        playerEspnId: resolved.espnId,
        playerPhotoUrl: resolved.photoUrl,
        playerTeam: resolved.team,
      },
    });
    updated += count;
  }

  return { scanned: batch.length, updated, remaining: Math.max(0, pending.length - batch.length) };
}
