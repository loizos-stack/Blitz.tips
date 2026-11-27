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

/**
 * Strip a locked premium pick down to what a non-subscriber may see.
 *
 * Blurring was never hiding. The card drew the real matchup, bet type and
 * price under `blur-sm`, which is a CSS filter over text that is still in the
 * HTML — view-source, devtools, a screen reader or curl all read straight
 * through it. A reader who could not be bothered to subscribe could be
 * bothered to press Ctrl-U.
 *
 * So the redaction happens here, on the server, before the pick is handed to a
 * component. The card cannot leak a field it was never given, and that holds
 * however the card is restyled later.
 *
 * What survives is what the teaser is allowed to advertise: that a premium
 * pick exists, for which sport, starting when. Everything that constitutes the
 * play itself goes — including the player, whose face and club give away as
 * much as the selection line does, and the parlay legs, which are the bet
 * spelled out.
 *
 * Odds and units become 0 rather than null because the schema has them
 * non-nullable; the locked card renders neither.
 */
export function redactLockedPick<
  T extends {
    matchup: string;
    selection: string;
    odds: number;
    units: number;
    analysis: string | null;
    league: string | null;
    playerName: string | null;
    playerPhotoUrl: string | null;
    playerTeam: string | null;
    playerEspnId: string | null;
  },
>(pick: T): T {
  return {
    ...pick,
    matchup: "",
    selection: "",
    odds: 0,
    units: 0,
    analysis: null,
    league: null,
    playerName: null,
    playerPhotoUrl: null,
    playerTeam: null,
    playerEspnId: null,
    // Present only on enriched picks and on parlays; blanked by name rather
    // than by type so a future field added to either is a compile error here
    // instead of a silent leak.
    ...("awayTeamLogo" in pick ? { awayTeamLogo: null } : {}),
    ...("homeTeamLogo" in pick ? { homeTeamLogo: null } : {}),
    ...("parlayLegs" in pick ? { parlayLegs: [] } : {}),
    ...("marketKey" in pick ? { marketKey: null } : {}),
    ...("side" in pick ? { side: null } : {}),
    ...("linePoint" in pick ? { linePoint: null } : {}),
    ...("oddsApiEventId" in pick ? { oddsApiEventId: null } : {}),
    ...("oddsApiSportKey" in pick ? { oddsApiSportKey: null } : {}),
  };
}
