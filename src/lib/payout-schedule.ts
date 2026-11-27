/**
 * When the next manual transfer goes out.
 *
 * Payouts on the platform-collected rails (card payments taken for a
 * handicapper who never connected Stripe, crypto, and off-platform transfers)
 * are sent by hand, every Tuesday. Saying so beside the figure is the whole
 * point: an amount with no date reads as "someday", which is what made this
 * balance something handicappers had to ask about.
 *
 * Plain module, no "server-only": the date is rendered on the server today and
 * may well be wanted in a client component later, and both have to agree.
 */

/** Tuesday, in `Date.getDay()` terms. */
const PAYOUT_WEEKDAY = 2;

/**
 * The next payout day on or after `from`.
 *
 * On a Tuesday this returns that same Tuesday rather than skipping a week —
 * the run happens during the day, so "today" is the honest answer right up
 * until it does, and a handicapper refreshing on payout morning should not be
 * told to wait another seven days.
 *
 * Returned at midnight local time because only the date is ever shown; keeping
 * a time of day on it would invite a caller to print one that means nothing.
 */
export function nextPayoutDate(from: Date = new Date()): Date {
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (PAYOUT_WEEKDAY - day.getDay() + 7) % 7;
  day.setDate(day.getDate() + delta);
  return day;
}

/** True when the next payout run is today. */
export function payoutIsToday(from: Date = new Date()): boolean {
  return from.getDay() === PAYOUT_WEEKDAY;
}
