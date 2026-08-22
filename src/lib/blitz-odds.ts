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
 * One line as we hold it: the same selection priced by one book over time.
 * `prices` is oldest-first.
 */
export interface BookHistory {
  bookmaker: string;
  prices: { price: number; capturedAt: Date }[];
}

export interface BookMove {
  bookmaker: string;
  from: number;
  to: number;
  delta: number;
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

/**
 * Decide whether one selection is dropping.
 *
 * Two rules, and the second is what makes this worth having:
 *
 *   1. Each book must shorten by at least `minProbDelta` points.
 *   2. At least `minBooks` distinct books must do it.
 *
 * A single book moving is noise — it can be a stale quote, a limit adjustment,
 * one trader's opinion, or the book simply correcting an error. It is when
 * independent books move the same way that the move carries information, which
 * is exactly why the request was for movement across more than one sportsbook.
 *
 * Books that drifted out are ignored rather than netted off. A market where two
 * books shorten and two lengthen is genuinely disagreeing, and averaging that to
 * zero would hide the thing worth seeing; requiring N books to shorten keeps the
 * signal and lets the disagreement show up as a smaller book count.
 */
export function detectDrop(
  histories: BookHistory[],
  opts: { minProbDelta: number; minBooks: number }
): DropSignal | null {
  const moves: BookMove[] = [];

  for (const h of histories) {
    const usable = h.prices.filter((p) => validAmerican(p.price));
    if (usable.length < 2) continue;

    // Baseline is the oldest price inside the lookback window, not the
    // all-time open: the caller decides the window, and a drop is "since we
    // started watching this window", so slow all-day drift doesn't keep
    // re-alerting.
    const from = usable[0].price;
    const to = usable[usable.length - 1].price;
    if (from === to) continue;

    const delta = probabilityDelta(from, to);
    if (delta >= opts.minProbDelta) moves.push({ bookmaker: h.bookmaker, from, to, delta });
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

/**
 * Whether an alert is still worth sending.
 *
 * Alerts stop `cutoffMinutes` before kickoff. Past that the price is about to
 * be academic — you cannot reasonably act on it, and books pull or freeze lines
 * into the off — so a late alert is noise that trains you to ignore the useful
 * ones.
 */
export function withinAlertWindow(
  commenceTime: Date,
  now: Date,
  cutoffMinutes: number
): boolean {
  return commenceTime.getTime() - now.getTime() > cutoffMinutes * 60_000;
}

export function minutesToStart(commenceTime: Date, now: Date): number {
  return Math.round((commenceTime.getTime() - now.getTime()) / 60_000);
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
