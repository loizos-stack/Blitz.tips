import "server-only";
import type { PickSport } from "@prisma/client";
import { validAmerican } from "@/lib/blitz-odds";

/**
 * Rundown (therundown.io) as an alternative feed for Blitz Odds only.
 *
 * WHY IT IS WORTH HAVING. It bills per REQUEST, not per (markets x regions), and
 * a request returns every bookmaker it carries. That inverts the economics of
 * the whole tool: with the Odds API, asking about more books or more markets
 * costs more, so the watcher is built around asking for as little as possible.
 * Here the cheapest request is the same price as the widest one, so the
 * bookmaker filter moves off the wire and into this file — we ask for
 * everything and keep what we want. Nothing about which books you watch can
 * cost you anything.
 *
 * It also keeps Blitz Odds off the quota the public board depends on. A runaway
 * watcher can no longer take the site's odds down with it.
 *
 * ⚠ UNVERIFIED. This sandbox cannot reach therundown.io, so every field name and
 * path below comes from their published shapes and has never seen a live
 * response. They are deliberately confined to this file, and
 * scripts/probe-rundown.mjs prints what the API actually returns so the mapping
 * can be corrected against fact rather than argued about. Until that has been
 * run, treat this adapter as a hypothesis — which is why the provider setting
 * still defaults to the Odds API.
 */

const DEFAULT_BASE = "https://therundown-therundown-v1.p.rapidapi.com";

export function rundownBase(): string {
  return (process.env.RUNDOWN_API_BASE?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
}

export function rundownKey(): string | undefined {
  return process.env.RUNDOWN_API_KEY?.trim() || undefined;
}

export function rundownConfigured(): boolean {
  return Boolean(rundownKey());
}

/**
 * Auth headers.
 *
 * Both spellings are sent because the same product is reachable through
 * RapidAPI and directly, with a different header on each, and sending the wrong
 * one alone produces a bare 401 that says nothing about which. Sending both
 * costs nothing and removes a question.
 */
export function rundownHeaders(): Record<string, string> {
  const key = rundownKey() ?? "";
  return {
    "x-rapidapi-key": key,
    "x-rapidapi-host": new URL(rundownBase()).host,
    "X-TheRundown-Key": key,
    Accept: "application/json",
  };
}

/**
 * PickSport → Rundown's numeric sport id.
 *
 * Their ids are stable but not guessable, and this map is the single most
 * likely thing here to be wrong. `RUNDOWN_SPORT_IDS` overrides it without a
 * deploy ("NFL:2,MLB:6"), and the probe prints the real list.
 */
const DEFAULT_SPORT_IDS: Partial<Record<PickSport, number>> = {
  NCAAF: 1,
  NFL: 2,
  MLB: 3,
  NBA: 4,
  NHL: 6,
  NCAAB: 5,
  UFC_MMA: 7,
  SOCCER: 10,
};

export function rundownSportIds(): Partial<Record<PickSport, number>> {
  const raw = process.env.RUNDOWN_SPORT_IDS?.trim();
  if (!raw) return DEFAULT_SPORT_IDS;

  const out: Partial<Record<PickSport, number>> = { ...DEFAULT_SPORT_IDS };
  for (const pair of raw.split(",")) {
    const [sport, id] = pair.split(":").map((s) => s.trim());
    const n = Number(id);
    if (sport && Number.isInteger(n)) out[sport as PickSport] = n;
  }
  return out;
}

// --- Wire shapes (unverified — see the note at the top) ---------------------

interface RdTeam {
  name?: string;
  mascot?: string;
  abbreviation?: string;
  is_home?: boolean;
  is_away?: boolean;
}

interface RdLine {
  affiliate?: { affiliate_id?: number; affiliate_name?: string };
  moneyline?: { moneyline_home?: number; moneyline_away?: number; moneyline_draw?: number };
  spread?: {
    point_spread_home?: number;
    point_spread_away?: number;
    point_spread_home_money?: number;
    point_spread_away_money?: number;
  };
  total?: {
    total_over?: number;
    total_under?: number;
    total_over_money?: number;
    total_under_money?: number;
  };
}

interface RdEvent {
  event_id?: string;
  event_date?: string;
  teams_normalized?: RdTeam[];
  lines?: Record<string, RdLine>;
}

interface RdEventsResponse {
  events?: RdEvent[];
}

/** The shape the poller already understands, so nothing downstream changes. */
export interface NormalOutcome {
  name: string;
  price: number;
  point?: number;
}
export interface NormalMarket {
  key: string;
  outcomes: NormalOutcome[];
}
export interface NormalBookmaker {
  key: string;
  title: string;
  markets: NormalMarket[];
}
export interface NormalEvent {
  id: string;
  commence_time: string;
  home_team?: string;
  away_team?: string;
  bookmakers: NormalBookmaker[];
}

/** Full team label, preferring "City Mascot" and degrading to whatever exists. */
function teamName(t: RdTeam | undefined): string {
  if (!t) return "";
  if (t.name && t.mascot && !t.name.includes(t.mascot)) return `${t.name} ${t.mascot}`;
  return t.name ?? t.mascot ?? t.abbreviation ?? "";
}

/** Book key we store against, lowercased so it matches the configured list. */
function bookKey(line: RdLine, fallbackId: string): string {
  const name = line.affiliate?.affiliate_name?.trim();
  if (name) return name.toLowerCase().replace(/\s+/g, "");
  return `affiliate-${line.affiliate?.affiliate_id ?? fallbackId}`;
}

/**
 * Turn one Rundown event into the internal shape.
 *
 * Books are filtered HERE rather than in the request, because the request costs
 * the same either way — see the header. `wanted` empty means keep everything,
 * which is what makes the probe useful: run with no filter and the panel's
 * "books seen" column shows every book this subscription actually carries.
 */
export function normalizeEvent(ev: RdEvent, wanted: string[]): NormalEvent | null {
  const id = ev.event_id ? String(ev.event_id) : null;
  if (!id || !ev.event_date) return null;

  const home = teamName(ev.teams_normalized?.find((t) => t.is_home));
  const away = teamName(ev.teams_normalized?.find((t) => t.is_away));

  const keep = new Set(wanted.map((w) => w.toLowerCase().replace(/\s+/g, "")));
  const bookmakers: NormalBookmaker[] = [];

  for (const [affiliateId, line] of Object.entries(ev.lines ?? {})) {
    const key = bookKey(line, affiliateId);
    if (keep.size > 0 && !keep.has(key)) continue;

    const markets: NormalMarket[] = [];

    const ml = line.moneyline;
    if (ml) {
      const outcomes: NormalOutcome[] = [];
      if (validAmerican(ml.moneyline_home) && home) outcomes.push({ name: home, price: ml.moneyline_home });
      if (validAmerican(ml.moneyline_away) && away) outcomes.push({ name: away, price: ml.moneyline_away });
      // Draw is a real selection in soccer and simply absent elsewhere.
      if (validAmerican(ml.moneyline_draw)) outcomes.push({ name: "Draw", price: ml.moneyline_draw });
      if (outcomes.length) markets.push({ key: "h2h", outcomes });
    }

    const sp = line.spread;
    if (sp) {
      const outcomes: NormalOutcome[] = [];
      // The handicap and its price are separate fields here, unlike the Odds
      // API where an outcome carries both. A missing price is left missing
      // rather than defaulted, so a spread never appears at a made-up number.
      if (typeof sp.point_spread_home === "number" && validAmerican(sp.point_spread_home_money) && home) {
        outcomes.push({ name: home, price: sp.point_spread_home_money, point: sp.point_spread_home });
      }
      if (typeof sp.point_spread_away === "number" && validAmerican(sp.point_spread_away_money) && away) {
        outcomes.push({ name: away, price: sp.point_spread_away_money, point: sp.point_spread_away });
      }
      if (outcomes.length) markets.push({ key: "spreads", outcomes });
    }

    const tot = line.total;
    if (tot) {
      const outcomes: NormalOutcome[] = [];
      if (typeof tot.total_over === "number" && validAmerican(tot.total_over_money)) {
        outcomes.push({ name: "Over", price: tot.total_over_money, point: tot.total_over });
      }
      if (typeof tot.total_under === "number" && validAmerican(tot.total_under_money)) {
        outcomes.push({ name: "Under", price: tot.total_under_money, point: tot.total_under });
      }
      if (outcomes.length) markets.push({ key: "totals", outcomes });
    }

    if (markets.length) {
      bookmakers.push({ key, title: line.affiliate?.affiliate_name ?? key, markets });
    }
  }

  return { id, commence_time: ev.event_date, home_team: home, away_team: away, bookmakers };
}

/**
 * UTC dates spanning a window from now.
 *
 * Rundown is queried a day at a time, so a game 20 minutes away at 23:50 UTC
 * lives under tomorrow's date. Returning both dates when the window straddles
 * midnight is the difference between working all day and going blind for half
 * an hour every night.
 */
export function datesCovering(now: Date, minutes: number): string[] {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(now.getTime() + minutes * 60_000);
  return day(now) === day(end) ? [day(now)] : [day(now), day(end)];
}

const REQUEST_TIMEOUT_MS = 20_000;

export interface RundownFetch {
  events: NormalEvent[] | null;
  error: string | null;
  /**
   * Every book the response carried, before the local filter.
   *
   * The filter is ours, not the API's, so a book list that matches nothing
   * produces a perfectly successful request with zero usable prices — the exact
   * shape of a quiet day. Reporting what WAS on offer is what turns that into a
   * fixable message instead of a mystery.
   */
  availableBooks: string[];
}

/** Book keys present on an event, ignoring the configured filter. */
function booksOn(ev: RdEvent): string[] {
  return Object.entries(ev.lines ?? {}).map(([id, line]) => bookKey(line, id));
}

/**
 * One day of a sport, with every book's lines.
 *
 * `include=all_periods` is deliberately NOT requested: the watcher only reads
 * full-game markets, and asking for periods would multiply the response size
 * for data nothing consumes.
 */
export async function fetchRundownDay(
  sportId: number,
  date: string,
  wantedBooks: string[]
): Promise<RundownFetch> {
  const url = `${rundownBase()}/sports/${sportId}/events/${date}`;
  try {
    const res = await fetch(url, {
      headers: rundownHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 401 || res.status === 403
          ? " — check RUNDOWN_API_KEY, and whether the key is for RapidAPI or the direct API"
          : res.status === 404
            ? " — usually a wrong sport id; run scripts/probe-rundown.mjs to list the real ones"
            : "";
      return {
        events: null,
        error: `Rundown responded ${res.status}${hint}. ${body.slice(0, 200)}`.trim(),
        availableBooks: [],
      };
    }
    const json = (await res.json()) as RdEventsResponse;
    const raw = json.events ?? [];
    const availableBooks = [...new Set(raw.flatMap(booksOn))];
    const events = raw
      .map((e) => normalizeEvent(e, wantedBooks))
      .filter((e): e is NormalEvent => e !== null);
    return { events, error: null, availableBooks };
  } catch (e) {
    return {
      events: null,
      error: e instanceof Error ? e.message : String(e),
      availableBooks: [],
    };
  }
}


// --- Probe ------------------------------------------------------------------

export interface RundownProbe {
  /** The host that answered, or null if none did. */
  base: string | null;
  // The body matters as much as the status. A host answered 200 with something
  // that was not JSON, and discarding it left the one useful fact unreadable —
  // whether that was an error page, an empty body, or a shape not mapped here.
  tried: { base: string; status: number; contentType: string; body: string }[];
  sports: { id: number; name: string }[];
  sampled: { sportId: number; name: string; date: string; events: number } | null;
  /** Book names carried on the sampled event — what the Books setting must match. */
  books: string[];
  /** Field names inside one line, which is what the adapter maps. */
  lineFields: { moneyline: string[]; spread: string[]; total: string[] };
  /** A real line's values, so wrong-looking numbers are visible too. */
  sampleLine: unknown;
  error: string | null;
}

/**
 * Ask Rundown what it actually returns.
 *
 * Three things in this adapter are guesses — the host and auth header, the
 * numeric sport ids, and the field names inside `lines` — and all three fail the
 * same way: a successful-looking request carrying nothing the watcher can use.
 * This resolves all three from one live call, which is the only thing that can.
 *
 * Runs server-side so the key never leaves Vercel, and reads only.
 */
export async function probeRundown(): Promise<RundownProbe> {
  const out: RundownProbe = {
    base: null,
    tried: [],
    sports: [],
    sampled: null,
    books: [],
    lineFields: { moneyline: [], spread: [], total: [] },
    sampleLine: null,
    error: null,
  };

  if (!rundownConfigured()) {
    out.error = "RUNDOWN_API_KEY is not set.";
    return out;
  }

  // The key itself does not say which host it belongs to, and the first live
  // check ruled out both of the obvious answers: the RapidAPI listing refused
  // with "You are not subscribed to this API", and api.therundown.io/v1 served
  // the marketing website as HTML. So the list is wider than a guess and every
  // entry is reported, which turns one run into an answer rather than another
  // round of the same question.
  //
  // rundown.io is included alongside therundown.io deliberately: the
  // subscription was described as being with the former, and assuming they are
  // the same company is exactly the sort of assumption that produced the two
  // dead hosts above.
  const candidates = [
    process.env.RUNDOWN_API_BASE?.trim(),
    "https://therundown-therundown-v1.p.rapidapi.com",
    "https://api.therundown.io/v2",
    "https://api.therundown.io/v1",
    "https://therundown.io/api/v2",
    "https://therundown.io/api/v1",
    "https://api.rundown.io/v1",
    "https://api.rundown.io",
  ].filter((b): b is string => Boolean(b));

  const key = rundownKey() ?? "";
  // Discovery walks several hosts, most of which are expected to be wrong. At
  // the full timeout a few dead ones would exhaust the function's own budget
  // before reaching the live one, so the walk gets a short leash and the real
  // request that follows keeps the normal one.
  const DISCOVERY_TIMEOUT_MS = 6_000;
  const call = async (base: string, path: string, timeoutMs = REQUEST_TIMEOUT_MS) => {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": new URL(base).host,
          "X-TheRundown-Key": key,
          // The direct product names its header differently from the RapidAPI
          // one, and which of the two this key belongs to is the open question.
          // Sending both costs nothing and rules one of them out.
          "x-api-key": key,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* keep the text for the error line */
      }
      return { status: res.status, json, text, contentType: res.headers.get("content-type") ?? "" };
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      return { status: 0, json: null, text, contentType: "" };
    }
  };

  // Whitespace-collapsed so an HTML page reads as one line rather than fifty.
  const snippet = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 300);

  for (const base of new Set(candidates)) {
    const r = await call(base, "/sports", DISCOVERY_TIMEOUT_MS);
    out.tried.push({ base, status: r.status, contentType: r.contentType, body: snippet(r.text) });
    if (r.status === 200 && r.json) {
      out.base = base;
      const list = (r.json as { sports?: { sport_id?: number; id?: number; sport_name?: string; name?: string }[] })
        .sports ?? [];
      out.sports = list
        .map((sp) => ({ id: Number(sp.sport_id ?? sp.id), name: String(sp.sport_name ?? sp.name ?? "") }))
        .filter((sp) => Number.isFinite(sp.id));
      // Stop at the first host that answers. Carrying on would spend requests on
      // hosts that cannot matter, and this endpoint is billed like any other.
      break;
    }
  }

  if (!out.base) {
    // A 200 that is not JSON is a different problem from a rejection, and
    // saying "no host answered" about one is simply wrong — a host did answer.
    const answered = out.tried.find((t) => t.status === 200);
    out.error = answered
      ? `${answered.base} answered 200 but not with JSON (content-type ${answered.contentType || "unset"}). The path or the response shape differs from the one mapped — the body is below.`
      : "Every host refused. Either the key belongs to a host not tried above — set RUNDOWN_API_BASE to it — or it is not valid for this product.";
    return out;
  }

  // Sample a sport that plays most days, so the probe is useful whenever it runs.
  const preferred = ["MLB", "NBA", "NHL", "NFL", "Soccer"];
  const pick = out.sports.find((sp) => preferred.includes(sp.name)) ?? out.sports[0];
  if (!pick) {
    out.error = "The host answered but listed no sports, so the response shape differs from the one mapped.";
    return out;
  }

  const date = new Date().toISOString().slice(0, 10);
  const r = await call(out.base, `/sports/${pick.id}/events/${date}`);
  if (r.status !== 200) {
    out.error = `Events request for ${pick.name} (id ${pick.id}) returned ${r.status}: ${r.text.slice(0, 200)}`;
    return out;
  }

  const events = ((r.json as RdEventsResponse)?.events ?? []) as RdEvent[];
  out.sampled = { sportId: pick.id, name: pick.name, date, events: events.length };
  if (events.length === 0) {
    out.error = `No ${pick.name} games listed for ${date} — try again on a match day, or the sport id is wrong.`;
    return out;
  }

  const sample = events[0];
  out.books = [...new Set(events.flatMap(booksOn))];

  const first = Object.values(sample.lines ?? {})[0];
  if (first) {
    out.lineFields = {
      moneyline: Object.keys(first.moneyline ?? {}),
      spread: Object.keys(first.spread ?? {}),
      total: Object.keys(first.total ?? {}),
    };
    out.sampleLine = { moneyline: first.moneyline, spread: first.spread, total: first.total };
  }

  return out;
}
