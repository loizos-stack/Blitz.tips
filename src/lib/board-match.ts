import type { UpcomingEvent } from "@/lib/odds-api";

/**
 * Finding the game someone is typing by hand on the odds board.
 *
 * A pick entered manually carries no `oddsApiEventId`, which means the settler
 * has nothing to look a score up by and has to grade it from the selection
 * text. That is the single biggest source of wrong and ungraded results on the
 * site. Most of the time the game was on the board all along and the
 * handicapper simply didn't look.
 *
 * So this matches what they are typing against the board and lets the form
 * offer the real fixture. It only ever *suggests* — the handicapper sees the
 * matchup and decides. That is deliberate: name matching across leagues is
 * never certain ("Inter" is two different clubs on two continents), and a
 * wrong auto-substitution would put a pick on a game nobody chose, which is
 * far worse than the problem being solved.
 */

/** Lowercase, unaccented, punctuation-free, single-spaced. */
export function normalizeTeam(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Noise words that carry no identity, so "FC Porto" and "Porto" are one club. */
const FILLER = new Set(["fc", "cf", "sc", "ac", "afc", "cd", "sv", "if", "bk", "club", "the"]);

function tokens(name: string): string[] {
  return normalizeTeam(name)
    .split(" ")
    .filter((t) => t && !FILLER.has(t));
}

/**
 * Whether two team names plausibly mean the same team.
 *
 * Generous on purpose — it is checked against both sides of a fixture before
 * anything is suggested, and requiring both to agree is what keeps the
 * generosity safe.
 */
export function sameTeam(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;

  const sa = ta.join(" ");
  const sb = tb.join(" ");
  if (sa === sb) return true;

  // "Lakers" for "Los Angeles Lakers". The nickname is the last word in every
  // North American league and the distinguishing one in most others, which is
  // what keeps Lakers and Clippers apart despite sharing a city.
  if (ta.at(-1) === tb.at(-1)) return true;

  // One name written in full, the other abbreviated: "Man City" / "Manchester
  // City". Whole words only, so "Inter" doesn't swallow "Internacional".
  const words = (s: string) => new RegExp(`(^| )${s.replace(/ /g, " ")}( |$)`);
  return words(sa).test(sb) || words(sb).test(sa);
}

export type BoardMatch = {
  event: UpcomingEvent;
  /** True when the handicapper typed the teams the other way round. */
  reversed: boolean;
};

/**
 * The board fixture that matches the teams being typed, if there is one.
 *
 * Both teams have to agree before anything is returned. With only one name
 * typed there is no suggestion at all: a lone "Lakers" matches every Lakers
 * game in the next week, and offering the wrong one teaches people to ignore
 * the prompt.
 */
export function findBoardMatch(
  events: readonly UpcomingEvent[],
  away: string,
  home: string
): BoardMatch | null {
  if (!away.trim() || !home.trim()) return null;

  for (const event of events) {
    if (sameTeam(away, event.awayTeam) && sameTeam(home, event.homeTeam)) {
      return { event, reversed: false };
    }
    // Home and away written the other way round is a typing habit, not a
    // different game — the board's own orientation is the one that counts.
    if (sameTeam(away, event.homeTeam) && sameTeam(home, event.awayTeam)) {
      return { event, reversed: true };
    }
  }
  return null;
}
