import "server-only";
import { normalizePlayerName } from "@/lib/player-photos";
import type { PickSport } from "@prisma/client";

/**
 * Player photos for the sports ESPN cannot serve.
 *
 * ESPN's athlete data is unusable outside the US pro leagues: EuroLeague
 * returns zero athletes, and every soccer league is a historical archive with
 * no row marked active and no headshot behind any id checked. TheSportsDB has
 * both — Haaland and Salah, Mičić and Mirotić — and this codebase already
 * talks to it for team badges, so the key and the account are already there.
 *
 * Looked up when a pick is written rather than synced into a table. A roster
 * sync works for five fixed leagues; it does not for "soccer", where the
 * leagues are endless and a prop on any of them is rare. One search on the
 * write path, and the answer is frozen onto the pick like every other.
 */

const DEFAULT_BASE = "https://www.thesportsdb.com/api/v1/json";

/**
 * The path segment that identifies a stored photo as a `strThumb` rather than
 * a `strCutout`. Exported so the refresh job can find the picks still carrying
 * one without re-implementing this knowledge of the URL shape.
 */
export const SPORTSDB_THUMB_MARKER = "/images/media/player/thumb/";

/** The `strSport` a result must carry to be accepted for one of our sports. */
const EXPECTED_SPORT: Partial<Record<PickSport, string>> = {
  SOCCER: "Soccer",
  NBA: "Basketball",
  WNBA: "Basketball",
  NCAAB: "Basketball",
  NFL: "American Football",
  NCAAF: "American Football",
  MLB: "Baseball",
  NHL: "Ice Hockey",
  TENNIS: "Tennis",
  GOLF: "Golf",
  UFC_MMA: "Fighting",
  // OTHER is deliberately absent: it means we do not know the sport, so there
  // is nothing to check a result against. EuroLeague picks filed under it rely
  // on the name having to match exactly, which is the stronger guard anyway.
};

export type SportsDbPhoto = { photoUrl: string; team: string | null };

interface SearchResult {
  strPlayer?: string;
  strSport?: string;
  strTeam?: string;
  /** Cut-out portrait on a transparent background. Preferred — see below. */
  strCutout?: string;
  /** Usually a match photograph, background and all. The fallback. */
  strThumb?: string;
}

/**
 * The small variant of a TheSportsDB image, and which field to take it from.
 *
 * `strCutout` first, and not as a matter of taste. The two fields are
 * different KINDS of picture: a cutout is a front-facing studio portrait with
 * the background removed, the same thing ESPN serves, while `strThumb` is
 * typically an in-game action shot — Durant's is him mid-game, looking off to
 * one side, against a blurred arena. Clipped into the card's 48px circle that
 * becomes a fragment of crowd and stadium lighting sitting next to the clean
 * cutouts on the NBA picks, and the tinted disc behind the avatar cannot help
 * because the background is baked into the JPEG.
 *
 * The cost of preferring it, measured on Durant: 40.6KB for the cutout against
 * 16.9KB for the thumb. Both are far below the un-resized originals, which are
 * 234KB and 166KB — the "/preview" suffix is what keeps either affordable, and
 * it is why a board of props is not megabytes of portraits.
 *
 * `strThumb` remains the fallback because a player can have one and not the
 * other. Of nine soccer and EuroLeague players checked, every one had both,
 * so this path should be rare.
 */
function previewUrl(hit: SearchResult): string | null {
  const image = hit.strCutout || hit.strThumb;
  return image ? `${image}/preview` : null;
}

/**
 * The photo for a player name, or null when nothing matches exactly.
 *
 * The exactness check is not optional. TheSportsDB's search is a prefix/
 * substring match: "John Smith" returns *John Patrick* Smith, a retired tennis
 * player, and a bare "Rollins" returns Seth Rollins the wrestler. Taking the
 * first result would put a stranger's face above someone's bet — the precise
 * failure the ESPN resolver refuses to risk, re-introduced through a second
 * source. So the returned name has to normalize to the name asked for, and the
 * sport has to agree where we know it.
 *
 * Accents are handled by that normalization rather than by the API: it finds
 * "Micić" from "Micic" and "Rodríguez" from "Rodriguez", and both sides
 * normalize to the same string.
 */
export async function sportsDbPlayerPhoto(
  sport: PickSport,
  name: string
): Promise<SportsDbPhoto | null> {
  const key = (process.env.SPORTSDB_API_KEY ?? process.env.THESPORTSDB_API_KEY)?.trim();
  const query = name.trim();
  if (!key || !query) return null;

  const base = process.env.SPORTSDB_API_BASE?.trim() || DEFAULT_BASE;
  const url = `${base}/${key}/searchplayers.php?p=${encodeURIComponent(query)}`;

  let players: SearchResult[];
  try {
    // Short timeout and fail-open: this runs while a handicapper is waiting for
    // their pick to post, and a slow third party must never be the reason a
    // pick fails to save. No photo is a fine outcome; a failed post is not.
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    players = ((await res.json()) as { player?: SearchResult[] | null }).player ?? [];
  } catch {
    return null;
  }

  const wanted = normalizePlayerName(query);
  const expectedSport = EXPECTED_SPORT[sport];

  const matches = players.filter((p) => {
    if (!p.strPlayer || !(p.strCutout || p.strThumb)) return false;
    if (normalizePlayerName(p.strPlayer) !== wanted) return false;
    return !expectedSport || p.strSport === expectedSport;
  });

  // Same rule as the ESPN resolver: exactly one, or nothing. Two players really
  // do share a name, and picking either is guessing.
  if (matches.length !== 1) return null;

  const hit = matches[0];
  const photoUrl = previewUrl(hit);
  if (!photoUrl) return null;
  return { photoUrl, team: hit.strTeam?.trim() || null };
}
