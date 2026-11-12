import { americanToDecimal } from "@/lib/odds";

/**
 * Closing line value.
 *
 * The market's price at kickoff is the closest thing betting has to a true
 * probability: it's what everyone's money settled on. A pick taken at a better
 * number than that close was, by that measure, a good bet — whether or not it
 * won. A pick taken at a worse number was a bad one, even if it won.
 *
 * That's why this matters more than a win rate on a site whose whole claim is
 * verified records: you can produce a flattering win rate by cherry-picking
 * which results you show, and you can produce a flattering ROI with a heater.
 * You cannot fake beating the close over a sample, because the closing price
 * isn't yours to choose.
 *
 * It's also the one number that stays meaningful while a capper is still
 * unlucky. Fifty picks of positive CLV and a losing record is a story about
 * variance; fifty picks of negative CLV and a winning record is a story about
 * variance too — pointing the other way.
 */

/** Percentage edge against the closing price. Positive means beat the close. */
export function clvPercent(takenOdds: number, closingOdds: number): number {
  const taken = americanToDecimal(takenOdds);
  const close = americanToDecimal(closingOdds);
  if (!Number.isFinite(taken) || !Number.isFinite(close) || close <= 1) return 0;
  return (taken / close - 1) * 100;
}

export interface ClvSummary {
  /** Picks that have both a taken price and a captured closing price. */
  measured: number;
  /** How many of those beat the close (a better price than the market closed at). */
  beat: number;
  /** Share of measured picks that beat the close, 0-100. Null when nothing measured. */
  beatRate: number | null;
  /** Mean CLV across measured picks, in percent. Null when nothing measured. */
  averageClv: number | null;
}

export function summarizeClv(
  picks: { odds: number; closingOdds: number | null }[]
): ClvSummary {
  const measured = picks.filter(
    (p): p is { odds: number; closingOdds: number } => p.closingOdds != null
  );
  if (measured.length === 0) {
    return { measured: 0, beat: 0, beatRate: null, averageClv: null };
  }

  const values = measured.map((p) => clvPercent(p.odds, p.closingOdds));
  // A tie against the close is not a beat. Rounding noise around zero would
  // otherwise inflate the headline number, which is the one people quote.
  const beat = values.filter((v) => v > 0.0001).length;

  return {
    measured: measured.length,
    beat,
    beatRate: (beat / measured.length) * 100,
    averageClv: values.reduce((sum, v) => sum + v, 0) / measured.length,
  };
}

/**
 * How many measured picks before the number is worth showing.
 *
 * CLV over a handful of picks is noise, and a "100% beat the close" badge off
 * three picks is the kind of claim that discredits the honest ones next to it.
 */
export const MIN_CLV_SAMPLE = 20;
