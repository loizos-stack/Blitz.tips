import "server-only";
import { getLiveGameStates, livePairKey } from "@/lib/espn-scores";
import type { PickSport } from "@prisma/client";

/**
 * Which of a reader's pending picks are actually in play right now.
 *
 * A pick whose game kicked off an hour ago is neither "upcoming" nor a result —
 * it's the most interesting thing on the page and the site had nowhere to put
 * it. It fell in with settled picks as an undifferentiated "Pending", which is
 * both wrong and a wasted moment: watching your capper's play unfold is the
 * stickiest screen a tips product has.
 *
 * The period/clock detail comes from ESPN's public scoreboard — free, cached for
 * 30 seconds, one request per distinct sport — so this costs no odds-API quota.
 * Where ESPN doesn't cover a sport (multi-league soccer, for one), the pick
 * still shows as live, just without a clock.
 */

// How long after kickoff a pending pick is still considered in play. Matches
// the odds client's own window, so the two can't disagree about what "live"
// means.
const IN_PLAY_WINDOW_MS = 4 * 60 * 60 * 1000;

interface LiveCandidate {
  sport: PickSport;
  matchup: string;
  eventStartsAt: Date;
  result: string;
}

export function isInPlay(pick: LiveCandidate, now = Date.now()): boolean {
  if (pick.result !== "PENDING") return false;
  const start = pick.eventStartsAt.getTime();
  return start <= now && now - start <= IN_PLAY_WINDOW_MS;
}

/**
 * Attach a live clock detail to whichever picks are in play.
 *
 * Returns a map of pick index → detail string; picks with no ESPN coverage or
 * no match are simply absent, and the caller shows a plain LIVE badge.
 */
export async function liveDetails<T extends LiveCandidate & { id: string; matchup: string }>(
  picks: T[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const inPlay = picks.filter((p) => isInPlay(p));
  if (inPlay.length === 0) return out;

  // One lookup per distinct sport, not per pick.
  const sports = [...new Set(inPlay.map((p) => p.sport))];
  const states = new Map<PickSport, Map<string, string>>();
  await Promise.all(
    sports.map(async (sport) => {
      states.set(sport, await getLiveGameStates(sport));
    })
  );

  for (const pick of inPlay) {
    const bySport = states.get(pick.sport);
    if (!bySport || bySport.size === 0) continue;
    // Matchups are stored "Away @ Home" / "A vs B"; the ESPN map is keyed on the
    // normalized pair, so try both orders rather than parsing the separator.
    const [left, right] = pick.matchup.split(/\s+(?:@|vs\.?)\s+/i);
    if (!left || !right) continue;
    const detail = bySport.get(livePairKey(left, right)) ?? bySport.get(livePairKey(right, left));
    if (detail) out.set(pick.id, detail);
  }

  return out;
}
