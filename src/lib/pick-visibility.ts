import type { PickResult } from "@prisma/client";

// Whether a premium pick should be hidden from a non-subscriber. Only *upcoming*
// plays sit behind the paywall — the moment a game has started (or the pick has
// been graded), it's revealed so the track record stays publicly verifiable.
// A premium pick that's still PENDING but whose event time has passed (e.g. a
// game that finished before auto-settlement graded it) is therefore shown, not
// locked forever.
export function isPickLocked(
  pick: { isPremium: boolean; result: PickResult; eventStartsAt: Date },
  unlocked: boolean
): boolean {
  if (!pick.isPremium || unlocked) return false;
  return pick.result === "PENDING" && pick.eventStartsAt.getTime() > Date.now();
}
