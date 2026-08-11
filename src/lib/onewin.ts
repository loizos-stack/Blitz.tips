/**
 * 1win affiliate linking.
 *
 * Shown only in the markets 1win actually operates in (ONEWIN_COUNTRIES below).
 * Everywhere else falls through to Stake, and the US sees neither — see
 * lib/sportsbooks, which is the single place that decides.
 *
 * Outbound links go through /api/go/onewin rather than straight to the domain,
 * for the same reasons as Stake: the referral code lives in one place, clicks
 * are countable, and — the important one here — the destination can change
 * without touching a single call site.
 *
 * ## That last point is not theoretical
 *
 * The affiliate URL is on a numbered mirror domain (one-vv0199.com). Books that
 * operate in markets where ISPs block them rotate these; the number in the host
 * is the giveaway. When it rotates, a hardcoded link doesn't error — it just
 * stops converting, and you find out from the revenue rather than from a bug
 * report. So the host is an env var, changeable without a deploy, and the
 * redirect route is the only thing that knows it.
 */
import type { PickSport } from "@prisma/client";

/** Affiliate landing host. Change this when the mirror rotates — no deploy needed. */
const DEFAULT_HOST = "https://one-vv0199.com";
export const ONEWIN_HOST = (process.env.NEXT_PUBLIC_ONEWIN_HOST?.trim() || DEFAULT_HOST).replace(/\/+$/, "");

/** Partner id from the affiliate dashboard (the `p` query parameter). */
export const ONEWIN_PARTNER_ID = process.env.NEXT_PUBLIC_ONEWIN_PARTNER_ID?.trim() || "u53a";

/** Landing path. Kept separate from the host so a rotation only changes one thing. */
const ONEWIN_PATH = "/betting";

/**
 * Markets where 1win is promoted, as ISO 3166-1 alpha-2.
 *
 * Supplied by the affiliate programme rather than inferred. Note Canada is on
 * the list and the US is not — so a North American visitor is not a single
 * case, and the two must not be conflated.
 *
 * No deep links here on purpose. Stake's table carries a `verified` flag
 * because an unconfirmed path segment is a guess, and a wrong guess on a deep
 * affiliate URL is a 404 dressed up as a working link. 1win's per-event URL
 * format hasn't been confirmed with the affiliate manager, so every link lands
 * on the sportsbook home. Add deep links once the format is documented, not
 * before.
 */
export const ONEWIN_COUNTRIES: ReadonlySet<string> = new Set([
  // Americas
  "AR", "BR", "CA", "CL", "CO", "EC", "MX", "VE",
  // Europe / Caucasus / Central Asia
  "AM", "AZ", "KG", "MD", "RU", "TJ", "TR", "UA", "UZ",
  // Asia-Pacific
  "BD", "ID", "IN", "KR", "MY", "PH", "PK", "TH", "VN",
  // Africa
  "BF", "BJ", "CD", "CI", "CM", "EG", "GH", "KE", "NG", "RW", "SN", "TG", "TZ", "UG", "ZM",
]);

export function isOneWinCountry(code: string | null | undefined): boolean {
  return Boolean(code && ONEWIN_COUNTRIES.has(code.toUpperCase()));
}

/** The affiliate destination. `sport` and `event` are carried for click logging only. */
export function oneWinUrl(): string {
  return `${ONEWIN_HOST}${ONEWIN_PATH}?p=${encodeURIComponent(ONEWIN_PARTNER_ID)}`;
}

/** Internal redirect href, so the outbound URL is never in the page source. */
export function oneWinGoHref(opts: { sport?: PickSport | string | null; event?: string | null }): string {
  const params = new URLSearchParams();
  if (opts.sport) params.set("sport", String(opts.sport));
  if (opts.event) params.set("event", String(opts.event));
  const qs = params.toString();
  return `/api/go/onewin${qs ? `?${qs}` : ""}`;
}
