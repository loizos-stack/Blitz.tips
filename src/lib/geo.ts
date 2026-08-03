import "server-only";
import { headers } from "next/headers";

/**
 * Where the visitor is, from the edge's geo-IP headers.
 *
 * Used to gate offshore-sportsbook promotion: Stake.com doesn't accept US
 * customers, so surfacing it to US traffic would send people to a wall — and
 * would advertise an unlicensed book in a regulated market.
 *
 * Vercel sets `x-vercel-ip-country`; the Cloudflare header is read as a
 * fallback so this still works behind a different proxy. When neither is
 * present (local dev, an unusual edge config, a VPN the edge can't place) we
 * treat the visitor as US. Failing closed matters here: showing the promo to
 * someone we can't place is the expensive mistake, hiding it is not.
 */
export async function visitorCountry(): Promise<string | null> {
  const h = await headers();
  const code = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  if (!code) return null;
  const upper = code.toUpperCase();
  // Cloudflare uses "XX" for unknown and "T1" for Tor.
  return upper === "XX" || upper === "T1" ? null : upper;
}

/** True only when the edge positively places the visitor outside the US. */
export async function isOutsideUs(): Promise<boolean> {
  const country = await visitorCountry();
  return country !== null && country !== "US";
}

// EU + EEA + UK + Switzerland — everywhere the GDPR/ePrivacy consent rules
// reach. Kept as one list because the practical obligation is the same in all
// of them, and splitting it would only invite one to drift.
const CONSENT_REQUIRED = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
  "SE", // EU
  "IS", "LI", "NO", // EEA
  "GB", "CH", // UK, Switzerland
]);

/**
 * Whether this visitor needs the cookie-consent prompt.
 *
 * Fails *open* — the opposite of isOutsideUs. When the edge can't place someone
 * we show the prompt anyway: an unnecessary banner is a mild annoyance, while
 * skipping it for someone actually in the EU is a compliance failure. The
 * expensive mistake is in the other direction here.
 */
export async function needsCookieConsent(): Promise<boolean> {
  const country = await visitorCountry();
  return country === null || CONSENT_REQUIRED.has(country);
}
