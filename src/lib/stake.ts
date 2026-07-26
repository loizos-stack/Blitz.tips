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
 * Our sports mapped onto Stake's URL structure, which is
 * `/sports/{sport}/{country}/{league}` — e.g. `/sports/baseball/usa/mlb`.
 *
 * `sport` is the section path and is always used. `league` is the deeper,
 * more relevant destination, but it is only used when `verified` is true.
 *
 * That distinction is the point of this table: an unconfirmed league segment is
 * a guess, and a wrong guess on a deep path is a 404 in an affiliate link —
 * strictly worse than landing on the correct sport section. So a league stays
 * commented-out-by-`verified: false` until someone has actually opened the URL.
 * Confirming one is a one-word edit.
 */
interface StakeSportPath {
  sport: string;
  league?: string;
  /** Has the full sport/country/league path been opened and confirmed? */
  verified?: boolean;
}

const SPORT_PATHS: Partial<Record<PickSport, StakeSportPath>> = {
  // Confirmed against the live site.
  NFL: { sport: "american-football", league: "usa/nfl", verified: true },
  MLB: { sport: "baseball", league: "usa/mlb", verified: true },

  // Same pattern, not yet opened — these fall back to the sport section.
  NBA: { sport: "basketball", league: "usa/nba" },
  WNBA: { sport: "basketball", league: "usa/wnba" },
  NHL: { sport: "ice-hockey", league: "usa/nhl" },
  NCAAF: { sport: "american-football", league: "usa/ncaa" },
  NCAAB: { sport: "basketball", league: "usa/ncaa" },

  // No single league to deep-link: our SOCCER spans many competitions, and
  // tennis/MMA are organised by tour and event rather than by country league.
  SOCCER: { sport: "soccer" },
  TENNIS: { sport: "tennis" },
  UFC_MMA: { sport: "mma" },
};

/** The real Stake URL for a sport, with the referral code attached. */
export function stakeUrl(sport?: PickSport | string | null): string {
  const entry = sport ? SPORT_PATHS[sport as PickSport] : undefined;
  let path = "/sports";
  if (entry) {
    path += `/${entry.sport}`;
    if (entry.verified && entry.league) path += `/${entry.league}`;
  }
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
