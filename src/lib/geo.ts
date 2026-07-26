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
