import type { PickSport } from "@prisma/client";

/**
 * Stake.com affiliate linking.
 *
 * Only ever shown to visitors the edge places outside the US (see lib/geo) —
 * Stake doesn't accept US customers, and promoting an unlicensed book to a
 * regulated market is not a mistake worth making for a click.
 *
 * Outbound links go through /api/go/stake rather than straight to the domain,
 * so the referral code lives in one place, clicks are countable, and the
 * destination can change without touching every call site.
 */

/** Referral code from the affiliate dashboard. Overridable without a deploy. */
export const STAKE_REFERRAL_CODE = process.env.NEXT_PUBLIC_STAKE_REFERRAL_CODE ?? "pE0AC4Ph";

const STAKE_BASE = "https://stake.com";

/**
 * Our sports mapped to Stake's section slugs.
 *
 * UNVERIFIED — these are the conventional slugs, but nobody has confirmed them
 * against the live site. Any sport whose slug is wrong lands on Stake's sports
 * home rather than 404ing (see stakeUrl), so a bad guess costs relevance, not a
 * broken link. Check them and fix this table.
 */
const SPORT_SLUGS: Partial<Record<PickSport, string>> = {
  NFL: "american-football",
  NCAAF: "american-football",
  NBA: "basketball",
  WNBA: "basketball",
  NCAAB: "basketball",
  MLB: "baseball",
  NHL: "ice-hockey",
  SOCCER: "soccer",
  TENNIS: "tennis",
  UFC_MMA: "mma",
};

/** The real Stake URL for a sport, with the referral code attached. */
export function stakeUrl(sport?: PickSport | string | null): string {
  const slug = sport ? SPORT_SLUGS[sport as PickSport] : undefined;
  const path = slug ? `/sports/${slug}` : "/sports";
  return `${STAKE_BASE}${path}?c=${encodeURIComponent(STAKE_REFERRAL_CODE)}`;
}

/**
 * The link to put in markup: our own redirect, which logs the click and then
 * forwards to `stakeUrl`. `event` is carried for analytics only — Stake has no
 * per-match URL we can build, so it never reaches the destination.
 */
export function stakeGoHref(opts: { sport?: PickSport | string | null; event?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (opts.sport) params.set("sport", String(opts.sport));
  if (opts.event) params.set("event", opts.event);
  const qs = params.toString();
  return `/api/go/stake${qs ? `?${qs}` : ""}`;
}
