import "server-only";
import { prisma } from "@/lib/prisma";
import { espnHeadshotUrl, normalizePlayerName, sportHasPhotos } from "@/lib/player-photos";
import { sportsDbPlayerPhoto } from "@/lib/player-photo-sportsdb";
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
 * The photo, club and ESPN id for a player name, or null when there is none.
 *
 * Called on the write path only — see the note on Pick.playerEspnId. Returning
 * null is an ordinary outcome, not a failure: an unmatched name simply renders
 * without a photo.
 *
 * Both sources are consulted, because each is better at a different thing.
 *
 * ESPN owns the FACTS. The Player table is synced from its rosters, so a match
 * there is by athlete id and carries the short club abbreviation the card
 * wants — "HOU", where TheSportsDB says "Houston Rockets" and overflows the
 * line.
 *
 * TheSportsDB owns the better PICTURE, when it has one. Its cutouts are
 * front-facing studio portraits framed for a circle, while ESPN's originals
 * are not square (Durant's is 600x436) and get padded, leaving the head small.
 *
 * Hence the ranking:
 *
 *   1. TheSportsDB cutout   — the preferred look
 *   2. ESPN's portrait      — clean, and present for every synced player
 *   3. TheSportsDB thumb    — last, because it is usually an in-game action
 *                             shot with the arena still in it
 *
 * The thumb sits below ESPN deliberately. Sampling 25 random players across
 * the five synced leagues, 17 had a cutout — so roughly a third would lose
 * their photo entirely on a TheSportsDB-only rule, worst in the NBA at 2 of 5.
 * Falling through to ESPN keeps coverage at 100% and still gives about
 * two-thirds of players the cutout. For soccer and EuroLeague there is no ESPN
 * rung at all, so the thumb remains their fallback as before.
 *
 * The cost is a live search on every write, where the synced leagues used to
 * answer from a local index. Picks are written rarely, the search has a 3s
 * timeout and fails open, and the answer is frozen onto the pick, so this is
 * once per pick rather than once per render.
 */
export async function resolvePlayer(
  sport: PickSport,
  playerName: string | null | undefined
): Promise<{ espnId: string | null; photoUrl: string; teamAbbr: string | null } | null> {
  if (!playerName?.trim()) return null;

  const normalizedName = normalizePlayerName(playerName);
  if (!normalizedName) return null;

  let espn: { espnId: string; teamAbbr: string | null; photoUrl: string } | null = null;

  if (sportHasPhotos(sport)) {
    // Two rows, not one: the second row is what tells us the name is
    // ambiguous. Taking the first of several would be the guess this function
    // exists to avoid.
    const matches = await prisma.player.findMany({
      where: { sport, normalizedName },
      select: { espnId: true, teamAbbr: true },
      take: 2,
    });

    // Two players share the name. Refused outright, without asking the second
    // source — a single TheSportsDB hit would not resolve the ambiguity, it
    // would just be the answer that happens to be convenient.
    if (matches.length > 1) return null;

    if (matches.length === 1) {
      const url = espnHeadshotUrl(sport, matches[0].espnId);
      if (url) {
        espn = { espnId: matches[0].espnId, teamAbbr: matches[0].teamAbbr, photoUrl: url };
      }
    }
  }

  const sportsDb = await sportsDbPlayerPhoto(sport, playerName);

  const photoUrl = sportsDb?.cutoutUrl ?? espn?.photoUrl ?? sportsDb?.thumbUrl ?? null;
  if (!photoUrl) return null;

  return {
    espnId: espn?.espnId ?? null,
    photoUrl,
    // ESPN's abbreviation wins when we have it; TheSportsDB's full club name
    // is the fallback for the sports ESPN cannot answer for.
    teamAbbr: espn?.teamAbbr ?? sportsDb?.team ?? null,
  };
}
