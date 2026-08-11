import { americanToDecimal } from "@/lib/odds";

/**
 * How a visitor wants prices written.
 *
 * Odds are stored and calculated in American throughout — `unitProfit`, ROI,
 * parlay combination and every settled record depend on it — so this is purely
 * a display conversion applied at the last moment. Nothing downstream of a
 * stored price changes with this setting.
 *
 * Plain module, no `server-only`: the root layout reads the visitor's choice
 * from a cookie and the menu control writes it, so both sides need this.
 */
export type OddsFormat = "american" | "decimal" | "fractional";

export const ODDS_FORMATS: readonly OddsFormat[] = ["american", "decimal", "fractional"];

/** American is the default because the board, the records and the site's audience are US-first. */
export const DEFAULT_ODDS_FORMAT: OddsFormat = "american";

export const ODDS_FORMAT_LABELS: Record<OddsFormat, string> = {
  american: "American",
  decimal: "Decimal",
  fractional: "Fractional",
};

/** The short tag beside each label, so the choice is obvious without knowing the jargon. */
export const ODDS_FORMAT_HINTS: Record<OddsFormat, string> = {
  american: "US",
  decimal: "EU",
  fractional: "UK",
};

/**
 * Cookie rather than localStorage: the server renders prices, so the choice has
 * to arrive with the request or the first paint shows the wrong format and then
 * corrects itself.
 *
 * Not httpOnly — the menu control sets it from the browser, and there is
 * nothing sensitive in a display preference.
 */
export const ODDS_FORMAT_COOKIE = "odds_format";
export const ODDS_FORMAT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseOddsFormat(value: string | null | undefined): OddsFormat {
  return ODDS_FORMATS.includes(value as OddsFormat) ? (value as OddsFormat) : DEFAULT_ODDS_FORMAT;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * American odds → fractional, exactly.
 *
 * Built from the American number rather than by converting the decimal back to
 * a fraction: a decimal is already rounded, so -110 would come out of that path
 * as 91/100 instead of the 10/11 a UK book actually prints.
 */
export function americanToFractional(odds: number): string {
  if (odds === 0) return "—";
  const [num, den] = odds > 0 ? [odds, 100] : [100, Math.abs(odds)];
  const divisor = gcd(num, den);
  return `${num / divisor}/${den / divisor}`;
}

export function formatOddsAs(odds: number, format: OddsFormat): string {
  switch (format) {
    case "decimal":
      return americanToDecimal(odds).toFixed(2);
    case "fractional":
      return americanToFractional(odds);
    case "american":
    default:
      return odds > 0 ? `+${odds}` : `${odds}`;
  }
}
