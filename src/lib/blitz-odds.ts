import "server-only";
import { americanToDecimal } from "@/lib/odds";

/**
 * Blitz Odds — detecting a shortening price.
 *
 * The whole tool rests on one question: has this selection got shorter, at more
 * than one book, since we last looked? Everything here answers that; fetching,
 * budgeting and delivery live in lib/blitz-odds-poll.
 *
 * The measurement is deliberately in implied probability rather than American
 * odds, because American odds are not a linear scale and comparing them
 * directly produces nonsense. A 20-point move means completely different things
 * in different parts of the range:
 *
 *   -110 → -130   is 52.4% → 56.5%   = 4.14 points of probability
 *   +200 → +180   is 33.3% → 35.7%   = 2.38 points
 *   +1000 → +980  is  9.1% →  9.2%   = 0.17 points
 *
 * Alerting on "moved 20 points of American odds" would fire constantly on
 * longshots and almost never on the favourites where the money actually is.
 * Probability puts every market on the same ruler, so one threshold is
 * meaningful across moneylines, spreads, totals and props alike.
 */

/**
 * Implied probability of an American price, as a percentage (0–100).
 *
 * This is the raw, vig-inclusive number — the book's price as offered, not a
 * de-vigged fair estimate. That is the right choice here: we are measuring how
 * far *the offer* moved, and de-vigging would require both sides of a market,
 * which props and alternates frequently do not give us.
 */
export function impliedProbability(american: number): number {
  const dec = americanToDecimal(american);
  if (!Number.isFinite(dec) || dec <= 1) return 0;
  return (1 / dec) * 100;
}

/**
 * How far a price shortened, in probability points. Positive = shorter (the
 * market moved toward this selection); negative = drifted out.
 */
export function probabilityDelta(from: number, to: number): number {
  return impliedProbability(to) - impliedProbability(from);
}

/**
 * Whether a number can be an American price at all.
 *
 * American odds are undefined between -100 and +100: -100 is already even
 * money, so -49 would be a book paying more than double on a favourite. Feeds
 * do occasionally emit junk, and a junk baseline would manufacture an enormous
 * fake "drop", so prices are checked before they are ever compared.
 */
export function validAmerican(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) >= 100;
}

/**
 * One observation of a price, tagged by how long was left before kickoff.
 *
 * Time-to-kickoff rather than a wall-clock timestamp, because every rule in
 * this tool is expressed relative to the start of the game. Storing the
 * relative figure at capture time means a delayed poll cannot silently be
 * treated as if it had arrived on schedule.
 */
export interface PricePoint {
  price: number;
  minutesToStart: number;
}

/** The same selection priced by one book across the run-up to kickoff. */
export interface BookHistory {
  bookmaker: string;
  prices: PricePoint[];
}

export interface BookMove {
  bookmaker: string;
  from: number;
  to: number;
  delta: number;
  /** Minutes-to-kickoff of each side of the comparison, so the claim is checkable. */
  fromMinutes: number;
  toMinutes: number;
}

export interface DropSignal {
  /** Books that shortened by at least the threshold. */
  moves: BookMove[];
  /** Mean shortening across those books, in probability points. */
  probDelta: number;
  /** Widest baseline and latest price across the moving books, for display. */
  openPrice: number;
  currentPrice: number;
}

export interface WindowOpts {
  minProbDelta: number;
  minBooks: number;
  /** Baseline is drawn from [baselineTo, baselineFrom] minutes before kickoff. */
  baselineFrom: number;
  baselineTo: number;
  /** The current price is read from [alertTo, alertFrom] minutes before kickoff. */
  alertFrom: number;
  alertTo: number;
}

/**
 * The latest observation inside a minutes-to-kickoff window.
 *
 * "Latest" means smallest minutes-remaining. For the baseline that gives the
 * price as it stood entering the final stretch, which is what makes the claim
 * "it shortened during the last fifteen minutes" true rather than approximate —
 * taking the 30-minute price instead would credit this window with movement
 * that happened before it.
 */
function latestIn(prices: PricePoint[], from: number, to: number): PricePoint | null {
  const inWindow = prices.filter(
    (p) => validAmerican(p.price) && p.minutesToStart <= from && p.minutesToStart >= to
  );
  if (inWindow.length === 0) return null;
  return inWindow.reduce((best, p) => (p.minutesToStart < best.minutesToStart ? p : best));
}

/**
 * Decide whether one selection is dropping into kickoff.
 *
 * The comparison is between two fixed bands rather than "then versus now": a
 * baseline taken 16-30 minutes out, and the current price 10-15 minutes out.
 * That is a deliberately narrow question — late money, not all-day drift — and
 * it means a line that moved hours earlier and then sat still raises nothing.
 *
 * The lower edge of the alert band matters as much as the upper one. Reporting
 * a move two minutes before kickoff is not useful: by the time the message is
 * read the price is gone. Ending the band at 10 minutes guarantees there is
 * still time to act on what the alert says.
 *
 * Two rules decide it:
 *
 *   1. Each book must shorten by at least `minProbDelta` points between those
 *      two windows.
 *   2. At least `minBooks` distinct books must do it.
 *
 * A single book moving is noise — a stale quote, a limit adjustment, one
 * trader's opinion. It is independent books agreeing that carries information.
 *
 * Books that drifted out are ignored rather than netted off. A market where one
 * book shortens and another lengthens is genuinely disagreeing, and averaging
 * that to zero would hide it; requiring N books to shorten keeps the signal and
 * lets disagreement show up as a smaller book count.
 */
export function detectDrop(histories: BookHistory[], opts: WindowOpts): DropSignal | null {
  const moves: BookMove[] = [];

  for (const h of histories) {
    const base = latestIn(h.prices, opts.baselineFrom, opts.baselineTo);
    const now = latestIn(h.prices, opts.alertFrom, opts.alertTo);
    // Both windows must have been sampled. If the poller missed one — a late
    // run, a book that only opened a price inside the last minutes — there is
    // nothing to compare and inventing a baseline would manufacture a drop.
    if (!base || !now) continue;
    if (base.price === now.price) continue;

    const delta = probabilityDelta(base.price, now.price);
    if (delta >= opts.minProbDelta) {
      moves.push({
        bookmaker: h.bookmaker,
        from: base.price,
        to: now.price,
        delta,
        fromMinutes: base.minutesToStart,
        toMinutes: now.minutesToStart,
      });
    }
  }

  if (moves.length < opts.minBooks) return null;

  const probDelta = moves.reduce((sum, m) => sum + m.delta, 0) / moves.length;

  // Show the move at its widest: the longest baseline and the shortest current
  // price among the books that moved. That is the span a bettor could actually
  // have caught, rather than an average that matches no real quote.
  const openPrice = moves.reduce((best, m) =>
    impliedProbability(m.from) < impliedProbability(best.from) ? m : best
  ).from;
  const currentPrice = moves.reduce((best, m) =>
    impliedProbability(m.to) > impliedProbability(best.to) ? m : best
  ).to;

  return { moves, probDelta, openPrice, currentPrice };
}

/**
 * Identity of a single bettable line.
 *
 * `point` is part of the identity, never dropped: "Over 8.5" and "Over 9.5" are
 * different bets, and folding them together would compare the price of one to
 * the price of the other and report the difference as movement.
 */
export function lineKey(marketKey: string, selection: string, point: number | null): string {
  return `${marketKey}|${selection}|${point ?? ""}`;
}

export function minutesToStart(commenceTime: Date, now: Date): number {
  return Math.round((commenceTime.getTime() - now.getTime()) / 60_000);
}

/**
 * Whether a game is inside the band where an alert may fire.
 *
 * Both edges are enforced. Too early and the late money has not arrived yet;
 * too late and the alert cannot be acted on, which trains you to ignore the
 * ones that can.
 */
export function inAlertWindow(minutes: number, alertFrom: number, alertTo: number): boolean {
  return minutes <= alertFrom && minutes >= alertTo;
}

/**
 * Whether a game is worth spending a request on right now.
 *
 * True only inside the baseline band or the alert band — never in the gap
 * between kickoff and the alert floor, and never before the baseline opens.
 * This is the single largest saving in the tool: for any given game the feed is
 * asked about it during roughly 21 minutes of its life and ignored the rest of
 * the time, and most leagues on most days are never asked about at all.
 */
export function inWatchWindow(
  minutes: number,
  opts: { baselineFrom: number; baselineTo: number; alertFrom: number; alertTo: number }
): boolean {
  const inBaseline = minutes <= opts.baselineFrom && minutes >= opts.baselineTo;
  return inBaseline || inAlertWindow(minutes, opts.alertFrom, opts.alertTo);
}

/**
 * Whether a fresh signal says anything new beyond one already reported.
 *
 * Without this the poller re-alerts the same drift every cycle: a line that
 * shortened four points an hour before kickoff is still four points shorter at
 * every subsequent poll. A repeat only earns a second alert if it has moved
 * another full threshold beyond the last one reported.
 */
export function isNewInformation(
  signal: DropSignal,
  previousProbDelta: number | null,
  minProbDelta: number
): boolean {
  if (previousProbDelta === null) return true;
  return signal.probDelta >= previousProbDelta + minProbDelta;
}

/** Compact "-110 → -130" for notification text. */
export function formatMove(from: number, to: number): string {
  const s = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return `${s(from)} → ${s(to)}`;
}
