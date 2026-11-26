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

/** The same, for the cut-out portraits that are now preferred everywhere. */
export const SPORTSDB_CUTOUT_MARKER = "/images/media/player/cutout/";

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

/**
 * Both images a player may have, kept apart rather than resolved here.
 *
 * The caller needs them separately because they rank differently against
 * ESPN's portrait: a cutout beats it, a thumb does not. Collapsing them to one
 * URL here would throw away the distinction the ordering depends on.
 */
export type SportsDbPhoto = {
  cutoutUrl: string | null;
  thumbUrl: string | null;
  team: string | null;
};

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

  // Exactly one, or nothing — but be clear about what this does and does not
  // catch, because it reads like a stronger guarantee than it is.
  //
  // TheSportsDB's search returns AT MOST ONE row, whatever is asked of it.
  // "Josh Allen" comes back as the Buffalo quarterback alone, with no sign
  // that the Jacksonville linebacker exists. So the length check cannot fire
  // on genuine ambiguity here; what actually protects a pick is the name and
  // sport comparison above, which rejects a row for somebody else.
  //
  // For the five synced leagues that is enough, because resolvePlayer asks the
  // Player table first and refuses outright when two rows share a name — so an
  // ambiguous NFL name never reaches this function. Soccer and EuroLeague have
  // no such rung, and for them this returns whichever single player the search
  // decided to surface.
  //
  // Mohamed Salah is the worked example. Asking for "Mohamed Salah" returns
  // "Omar Mohamed Salah Mohamed" of Petrojet, which the name check rejects, so
  // a Salah prop gets no photo. That is the correct outcome and not a bug to
  // fix: the only "Mohamed Salah" the service does hold plays for Trabzonspor,
  // so making the lookup succeed would put a stranger's face above a Liverpool
  // prop. No photo beats the wrong photo.
  if (matches.length !== 1) return null;

  const hit = matches[0];
  return {
    cutoutUrl: hit.strCutout ? `${hit.strCutout}/preview` : null,
    thumbUrl: hit.strThumb ? `${hit.strThumb}/preview` : null,
    team: hit.strTeam?.trim() || null,
  };
}
