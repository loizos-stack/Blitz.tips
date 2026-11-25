import { prisma } from "@/lib/prisma";
import { normalizePlayerName } from "@/lib/player-photos";
import type { PickSport } from "@prisma/client";

/**
 * Filling the Player table from ESPN.
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
  /** Rows ESPN listed as active, before writing. */
  active: number;
  /** Rows now in the table for this sport. */
  written: number;
  /** Names shared by more than one player — these will never show a photo. */
  ambiguous: number;
};

const PAGE = 1000;

/**
 * Every active athlete in a league.
 *
 * Pages because ESPN's lists are historical archives rather than rosters, and
 * filters on each row's own `active` flag because the endpoint accepts
 * `active=true` and ignores it — the count comes back identical either way.
 * That flag is the only thing separating this season's players from everyone
 * who ever played.
 */
async function fetchActiveAthletes(path: string): Promise<{ espnId: string; fullName: string }[]> {
  const out: { espnId: string; fullName: string }[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const res = await fetch(
      `https://sports.core.api.espn.com/v3/sports/${path}/athletes?limit=${PAGE}&page=${page}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`${path} page ${page}: HTTP ${res.status}`);
    const body = (await res.json()) as {
      pageCount?: number;
      items?: { id?: string | number; fullName?: string; displayName?: string; active?: boolean }[];
    };

    pageCount = body.pageCount ?? 1;
    for (const a of body.items ?? []) {
      if (!a.active) continue;
      const fullName = a.fullName || a.displayName;
      if (!a.id || !fullName) continue;
      out.push({ espnId: String(a.id), fullName });
    }
    page += 1;
  } while (page <= pageCount);

  return out;
}

/**
 * Replace one league's players with what ESPN currently lists.
 *
 * Delete-then-insert inside a transaction rather than a row-by-row upsert, for
 * two reasons. It is one round trip instead of a few thousand, which is what
 * keeps this inside a function's time budget. And it drops players who have
 * left the league, which an upsert loop never does — without it the table only
 * ever grows, and retired players accumulate until two of them share a name
 * with somebody active and quietly cost that player their photo.
 *
 * An empty result is left alone deliberately. ESPN returned 14 WNBA athletes
 * out of season; treating that as the truth would wipe a league's photos for
 * the off-season and report success.
 */
export async function syncPlayersForSport(sport: PickSport): Promise<SyncReport> {
  const path = SYNC_LEAGUES[sport];
  if (!path) throw new Error(`${sport} has no ESPN headshot league`);

  const athletes = await fetchActiveAthletes(path);

  const rows = athletes
    .map((a) => ({
      sport,
      espnId: a.espnId,
      fullName: a.fullName,
      normalizedName: normalizePlayerName(a.fullName),
      active: true,
    }))
    .filter((r) => r.normalizedName);

  if (rows.length === 0) {
    const existing = await prisma.player.count({ where: { sport } });
    return { sport, active: 0, written: existing, ambiguous: 0 };
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

  return { sport, active: rows.length, written, ambiguous: dupes.length };
}
