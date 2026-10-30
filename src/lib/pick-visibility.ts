import type { PickResult } from "@prisma/client";

// How long a premium pick stays behind the paywall *after* its event has
// started. Subscribers who paid still see it immediately; for everyone else the
// paid play is revealed two hours after kickoff, by which point the edge is
// gone but the record becomes publicly verifiable. For a parlay this is measured
// from the last leg's start time (the parent pick's eventStartsAt is set to the
// latest game — see create-parlay-form.tsx), so the whole slip unlocks two hours
// after its final game kicks off.
export const PICK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;

/**
 * Whether a handicapper may grade their own pick yet.
 *
 * Not before the event has started. Grading a game that has not kicked off is
 * not a result, it is a claim about the future — and since a handicapper's
 * grade is final and feeds their public record, units and ROI, an unstarted
 * "Win" is simply a fabricated one. This was reachable: the settle endpoint
 * checked ownership and that the pick was still pending, and nothing else.
 *
 * Kickoff is the line because it is the same line the auto-settler already
 * draws — it only considers picks whose event has started — so hand-grading now
 * obeys the rule the machine has always obeyed.
 *
 * Deliberately NOT a guarantee the result is known: a full game is undecided
 * for hours after kickoff, and this permits grading a minute in. Closing that
 * would mean modelling how long each sport and market takes to settle, and
 * would block legitimate early grades (a first-half line, a settled prop). The
 * check that catches a wrong grade after kickoff is the auto-settler and the
 * admin panel's self-settled flag, not this.
 *
 * Shared by the settle endpoint and the dashboard row on purpose: one rule,
 * enforced on the server, mirrored in the UI, with no way for the two to drift.
 */
export function isGradableByHandicapper(
  pick: { eventStartsAt: Date },
  now: Date = new Date()
): boolean {
  return pick.eventStartsAt.getTime() <= now.getTime();
}

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
