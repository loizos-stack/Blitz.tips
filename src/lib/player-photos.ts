import type { PickSport } from "@prisma/client";

/**
 * Putting a player's face on a pick card.
 *
 * A pick stores a player's NAME and nothing else, so showing a photo means
 * turning that name into an ESPN athlete id. That is a string match, and string
 * matches are wrong sometimes — which matters more here than it looks. A wrong
 * crest on a fixture is a cosmetic bug; the wrong person's face above someone's
 * stake is the site appearing to say "this is who you are betting on" and being
 * incorrect. On a site whose entire pitch is a record you can check, that is
 * the expensive kind of wrong.
 *
 * So this follows the same rule as board-match.ts: it never guesses. An exact
 * normalized match against exactly one player wins. Two players share the name,
 * or nothing matches — no photo, and the card renders as it always did.
 *
 * This half is deliberately pure — no prisma, no "server-only". pick-card.tsx
 * is pulled into a client bundle, so the URL builder it needs cannot sit in the
 * same module as a database query. The lookup lives in player-lookup.ts.
 */

/** Which ESPN path each sport's headshots live under. */
const ESPN_HEADSHOT_PATH: Partial<Record<PickSport, string>> = {
  NFL: "nfl",
  NBA: "nba",
  WNBA: "wnba",
  MLB: "mlb",
  NHL: "nhl",
};

/**
 * The sports a photo can be shown for at all.
 *
 * Pro leagues only, and that is a finding rather than a preference. ESPN's
 * athlete lists are historical archives: college football returns 254,099
 * people, and every soccer league carries 7,000+ with not one row marked active
 * and no headshot behind any id that was checked. Asking for those is asking
 * for 404s.
 *
 * Soccer and Euroleague photos DO exist at TheSportsDB, which this codebase
 * already talks to for team badges (lib/sportsdb.ts) — its `strThumb` with a
 * "/preview" suffix is ~15KB, the same weight as the crests. That is the way in
 * if those sports are ever wanted; the resolver below would gain a second
 * source and the rest of this file would not change.
 */
export const PHOTO_SPORTS = Object.keys(ESPN_HEADSHOT_PATH) as PickSport[];

export function sportHasPhotos(sport: PickSport): boolean {
  return sport in ESPN_HEADSHOT_PATH;
}

/**
 * A player's name reduced to what two spellings of the same person share.
 *
 * Accents go because feeds disagree about them ("Mirotić" / "Mirotic"), and
 * punctuation goes because of the apostrophes and hyphens in names like
 * "De'Aaron" and "Nelson-Ododa". Suffixes go because a handicapper types "Ken
 * Walker" for the player ESPN lists as "Kenneth Walker III" about as often as
 * not.
 *
 * Deliberately NOT a fuzzy match. Dropping a suffix is a rule that is either
 * right or wrong and can be read; edit distance is a dial that silently decides
 * Josh Allen is Josh Allen the linebacker.
 */
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function normalizePlayerName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  // Only strip a trailing suffix, and never the whole name: "Jr" on its own is
  // somebody's actual entry in the table.
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/**
 * ESPN's headshot URL, at the size it will actually be drawn.
 *
 * The /combiner/ endpoint is not decoration — it is the whole reason this is
 * affordable. ESPN ignores `?w=` on the plain path and serves the full-size
 * original: LeBron's headshot is 206KB that way, and 10.7KB through the
 * combiner at 96px. Putting a dozen 206KB portraits on a board would undo every
 * byte the lazy-loaded crests save.
 *
 * 96px for a 48px avatar, so it stays sharp on a 2x screen.
 */
export function espnHeadshotUrl(sport: PickSport, espnId: string, size = 96): string | null {
  const path = ESPN_HEADSHOT_PATH[sport];
  if (!path) return null;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/${path}/players/full/${espnId}.png&w=${size}&h=${size}`;
}
