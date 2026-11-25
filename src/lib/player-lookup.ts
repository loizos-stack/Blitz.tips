import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizePlayerName, sportHasPhotos } from "@/lib/player-photos";
import type { PickSport } from "@prisma/client";

/**
 * Turning a player's name into an ESPN id, against the Player table.
 *
 * Split from player-photos.ts because that module is reached from a client
 * bundle (pick-card renders inside one) and this one touches the database.
 * Keeping the query here is what lets the URL builder stay importable from
 * anywhere.
 */

/**
 * The ESPN id and club for a player name, or null when there is not exactly one.
 *
 * Called on the write path only — see the note on Pick.playerEspnId. Returning
 * null is an ordinary outcome, not a failure: most sports have no photos at
 * all, and an unmatched name simply renders without one.
 */
export async function resolvePlayer(
  sport: PickSport,
  playerName: string | null | undefined
): Promise<{ espnId: string; teamAbbr: string | null } | null> {
  if (!playerName?.trim() || !sportHasPhotos(sport)) return null;

  const normalizedName = normalizePlayerName(playerName);
  if (!normalizedName) return null;

  // Two rows, not one: the second row is what tells us the name is ambiguous.
  // Taking the first of several would be the guess this function exists to
  // avoid.
  const matches = await prisma.player.findMany({
    where: { sport, normalizedName },
    select: { espnId: true, teamAbbr: true },
    take: 2,
  });

  return matches.length === 1 ? { espnId: matches[0].espnId, teamAbbr: matches[0].teamAbbr } : null;
}
