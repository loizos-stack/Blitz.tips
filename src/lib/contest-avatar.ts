/**
 * One rule for which picture represents a contest entrant, so every contest
 * surface shows the same face.
 *
 * Precedence, highest first:
 *   1. Handicapper profile avatar — a handicapper's contest identity *is* their
 *      handicapper identity. Reusing it means one picture to keep updated
 *      rather than two that drift apart, and it makes a capper recognisable
 *      across the leaderboard and the contest board.
 *   2. The entry's own uploaded avatar — for entrants who aren't handicappers.
 *   3. The account image (e.g. a Google avatar), free and already there.
 *   4. Nothing, and the UI falls back to initials.
 *
 * Deliberately pure and dependency-free: the standings, entrant pages and the
 * dashboard all resolve through this, and it needs to run on both sides.
 */

export interface EntrantAvatarSources {
  /** ContestEntry.avatarUrl */
  entryAvatarUrl?: string | null;
  /** HandicapperProfile.avatarUrl, when the entrant is also a handicapper. */
  handicapperAvatarUrl?: string | null;
  /** User.image — OAuth avatar. */
  userImage?: string | null;
  /**
   * Whether this entrant has a handicapper profile at all — independent of
   * whether it carries a picture yet. Ownership of the contest avatar follows
   * the profile's existence, not its contents: a handicapper who hasn't set an
   * avatar still manages it from their handicapper profile.
   */
  isHandicapper?: boolean;
}

export function entrantAvatar(sources: EntrantAvatarSources): string | null {
  const first = [
    sources.handicapperAvatarUrl,
    sources.entryAvatarUrl,
    sources.userImage,
  ].find((url) => typeof url === "string" && url.trim().length > 0);
  return first?.trim() ?? null;
}

/**
 * True when this entrant's picture is owned by their handicapper profile and so
 * can't be changed from the contest dashboard.
 *
 * Keyed on having a profile, not on that profile having an avatar yet. Keying
 * it on the picture would offer a handicapper with no avatar a contest upload
 * that the API rejects — and if it didn't reject it, setting a handicapper
 * avatar later would silently replace what they'd uploaded here.
 */
export function avatarIsFromHandicapper(sources: EntrantAvatarSources): boolean {
  return Boolean(sources.isHandicapper);
}

/**
 * Up to two letters for the initials fallback. Handles "jane_doe", "jane doe"
 * and "JaneDoe" alike; falls back to "?" for a name with nothing usable in it.
 */
export function entrantInitials(name: string): string {
  const words = name
    .replace(/[_.-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) {
    const word = words[0]!;
    // Split a camelCase / PascalCase handle into its humps before giving up.
    const humps = word.match(/[A-Z][a-z]*/g);
    if (humps && humps.length >= 2) return (humps[0]![0]! + humps[1]![0]!).toUpperCase();
    return word.slice(0, 2).toUpperCase();
  }
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
