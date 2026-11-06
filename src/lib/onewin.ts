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
 * 1win publishes no deep-link API, so the URL shape is reverse-engineered from
 * real links:
 *
 *   /betting/prematch/football-18/uefa-europa-league-39438?p=u53a
 *            ^^^^^^^^ ^^^^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^
 *            section  sport       competition
 *
 * Both of the last two are `{slug}-{id}`. The slug reads like something you
 * could derive from a name — the id does not. It is an opaque key from their
 * database, and there is no rule that turns "Premier League" into the right
 * number. So every segment below is either copied from a link someone actually
 * opened, or absent.
 */
const ONEWIN_PREMATCH = "prematch";

interface OneWinSegment {
  /** The `{slug}-{id}` path segment, copied verbatim from a real 1win URL. */
  segment: string;
  /**
   * Has this exact segment been seen in a working link? Same discipline as
   * Stake's table: an unverified deep segment is a guess, and a wrong guess is
   * a 404 wearing the costume of a working affiliate link — strictly worse than
   * landing one level up. Unverified entries are ignored at build time, so
   * adding one is safe and confirming it is a one-word edit.
   */
  verified?: boolean;
}

/**
 * Our sport → 1win's sport section. Every segment below was copied from a live
 * URL, so all of them are verified.
 *
 * Several of our sports share one section, which is right rather than a
 * shortcut: 1win organises by sport and lists the competitions inside, so the
 * college and women's leagues land on the page that carries them. Getting a
 * competition-level link for those needs an entry in LEAGUE_SEGMENTS, not a
 * different section here.
 *
 * GOLF and OTHER are deliberately absent — no section link has been seen for
 * them, so they fall back to the sportsbook home rather than guess.
 */
const SPORT_SECTIONS: Partial<Record<PickSport, OneWinSegment>> = {
  SOCCER: { segment: "football-18", verified: true },
  NFL: { segment: "american-football-21", verified: true },
  NCAAF: { segment: "american-football-21", verified: true },
  NBA: { segment: "basketball-23", verified: true },
  WNBA: { segment: "basketball-23", verified: true },
  NCAAB: { segment: "basketball-23", verified: true },
  MLB: { segment: "baseball-29", verified: true },
  NHL: { segment: "ice-hockey-35", verified: true },
  TENNIS: { segment: "tennis-33", verified: true },
  UFC_MMA: { segment: "ufc-137", verified: true },
};

/**
 * Odds-API league key → 1win competition, keyed the way our events already
 * identify themselves (`UpcomingEvent.sportKey`, `Pick.oddsApiSportKey`) so no
 * new plumbing is needed to look one up.
 *
 * `sport` is repeated per entry rather than inferred from the key's prefix:
 * these are the two halves of one URL, and pairing them here means a competition
 * can never be pasted under the wrong section.
 */
interface OneWinLeague extends OneWinSegment {
  sport: PickSport;
}

const LEAGUE_SEGMENTS: Record<string, OneWinLeague> = {
  soccer_uefa_europa_league: { sport: "SOCCER", segment: "uefa-europa-league-39438", verified: true },
};

/** How many competitions currently deep-link. Surfaced so the gap is visible. */
export function oneWinVerifiedLeagueCount(): number {
  return Object.values(LEAGUE_SEGMENTS).filter((l) => l.verified).length;
}

/**
 * Markets where 1win is promoted, as ISO 3166-1 alpha-2.
 *
 * Supplied by the affiliate programme rather than inferred. Note Canada is on
 * the list and the US is not — so a North American visitor is not a single
 * case, and the two must not be conflated.
 *
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

/**
 * The affiliate destination, as deep as the table can prove.
 *
 * Degrades one level at a time rather than all-or-nothing: a known competition
 * lands on that competition, a known sport with an unmapped competition lands
 * on the sport, and anything else lands on the sportsbook home. Every one of
 * those is a page that exists — which is the whole point of not guessing ids.
 *
 * `event` is deliberately absent. A single fixture would be the best
 * destination of all, but its id lives in 1win's database and nothing we hold
 * maps to it; it stays a click-analytics field until they hand over a format.
 */
export function oneWinUrl(opts: { sport?: PickSport | string | null; league?: string | null } = {}): string {
  // hasOwn, not a bare index: the key arrives from a query string, and a plain
  // object would happily answer "constructor" or "toString" with something off
  // the prototype chain. Those fall through harmlessly today only because they
  // lack a `verified` field, which is luck rather than a rule.
  const league =
    opts.league && Object.hasOwn(LEAGUE_SEGMENTS, opts.league) ? LEAGUE_SEGMENTS[opts.league] : undefined;
  // A competition implies its own sport, which beats whatever the caller
  // guessed — a soccer league can only sit under the football section.
  const sportKey = (league?.sport ?? opts.sport) as PickSport | undefined;
  const section = sportKey ? SPORT_SECTIONS[sportKey] : undefined;

  let path = ONEWIN_PATH;
  if (section?.verified) {
    path += `/${ONEWIN_PREMATCH}/${section.segment}`;
    // Only ever nested under a verified section, so a competition can't be
    // reached by a path whose parent is itself unconfirmed.
    if (league?.verified) path += `/${league.segment}`;
  }
  return `${ONEWIN_HOST}${path}?p=${encodeURIComponent(ONEWIN_PARTNER_ID)}`;
}

/** Internal redirect href, so the outbound URL is never in the page source. */
export function oneWinGoHref(opts: {
  sport?: PickSport | string | null;
  /** Odds-API league key, e.g. "soccer_epl" — what picks the deep link. */
  league?: string | null;
  event?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.sport) params.set("sport", String(opts.sport));
  if (opts.league) params.set("league", String(opts.league));
  if (opts.event) params.set("event", String(opts.event));
  const qs = params.toString();
  return `/api/go/onewin${qs ? `?${qs}` : ""}`;
}
