import type { PickResult } from "@prisma/client";

// How long a premium pick stays behind the paywall *after* its event has
// started. Subscribers who paid still see it immediately; for everyone else the
// paid play is revealed two hours after kickoff, by which point the edge is
// gone but the record becomes publicly verifiable. For a parlay this is measured
// from the last leg's start time (the parent pick's eventStartsAt is set to the
// latest game — see create-parlay-form.tsx), so the whole slip unlocks two hours
// after its final game kicks off.
export const PICK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;

// Whether a premium pick should be hidden from a non-subscriber. A paid play
// sits behind the paywall until two hours after its event starts (or until it's
// graded), then it's revealed so the track record stays publicly verifiable.
// A premium pick that's still PENDING but whose unlock time has passed (e.g. a
// game that finished before auto-settlement graded it) is therefore shown, not
// locked forever.
export function isPickLocked(
  pick: { isPremium: boolean; result: PickResult; eventStartsAt: Date },
  unlocked: boolean
): boolean {
  if (!pick.isPremium || unlocked) return false;
  return (
    pick.result === "PENDING" &&
    pick.eventStartsAt.getTime() + PICK_UNLOCK_DELAY_MS > Date.now()
  );
}
