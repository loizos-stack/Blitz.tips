import "server-only";
import { prisma } from "@/lib/prisma";
import { oddsApiKey } from "@/lib/odds-api";
import type { PickSport } from "@prisma/client";

const API_BASE = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";

/**
 * Capture the closing price for picks whose game is about to start.
 *
 * "Closing" here means the last price we could see before kickoff, which is the
 * practical definition anyone can verify. The job runs shortly before games
 * start, prices whatever is in its window, and stamps the time it captured so
 * the number is auditable rather than asserted.
 *
 * Cost is the reason this is a separate, optional job rather than something the
 * board does. Every other odds call in this codebase is paid for by a page view
 * and shared through a cache; this one is driven by kickoff times, so it spends
 * on a schedule whether or not anyone visits. It fetches once per distinct
 * league in the window — not once per pick — and it only looks at picks that
 * came off the board (a manually typed pick has no event to re-price).
 */

const CAPTURE_WINDOW_MS = 90 * 60 * 1000; // games starting within 90 minutes

export interface ClvCaptureReport {
  candidates: number;
  captured: number;
  /** Picks whose selection couldn't be found in the current market. */
  unmatched: number;
  /** Distinct league requests made — this is what the run costs. */
  leaguesFetched: number;
  errors: string[];
}

interface ApiOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface ApiEvent {
  id: string;
  bookmakers: { key: string; markets: { key: string; outcomes: ApiOutcome[] }[] }[];
}

/**
 * Find the current price for a pick's exact selection.
 *
 * Matching is on the structured fields the pick form captured (marketKey, side,
 * linePoint), not on the display string — a spread that moved from -3.5 to -4.5
 * is a different bet, and pricing it as though it were the same one would
 * manufacture CLV that nobody earned. A pick whose line no longer exists is
 * reported unmatched rather than approximated.
 */
export function findClosingPrice(
  event: ApiEvent,
  pick: { marketKey: string | null; side: string | null; linePoint: number | null; playerName: string | null }
): number | null {
  if (!pick.marketKey || !pick.side) return null;

  const prices: number[] = [];
  for (const book of event.bookmakers) {
    const market = book.markets.find((m) => m.key === pick.marketKey);
    if (!market) continue;
    for (const outcome of market.outcomes) {
      if (outcome.name !== pick.side) continue;
      if (pick.playerName && outcome.description !== pick.playerName) continue;
      // The line has to be the same line. A half-point is a different bet.
      if (pick.linePoint != null && Math.abs((outcome.point ?? NaN) - pick.linePoint) > 0.001) continue;
      prices.push(outcome.price);
    }
  }
  if (prices.length === 0) return null;

  // The best price available across books at the close, which is the same
  // standard the pick itself was taken at (the board shows a best-of set).
  return prices.reduce((best, p) => (decimalish(p) > decimalish(best) ? p : best));
}

/** American odds ordered by payout, so +150 ranks above -110. */
function decimalish(american: number): number {
  return american > 0 ? american / 100 : 100 / -american;
}

export async function runClvCapture(opts: { dryRun?: boolean } = {}): Promise<ClvCaptureReport> {
  const report: ClvCaptureReport = {
    candidates: 0,
    captured: 0,
    unmatched: 0,
    leaguesFetched: 0,
    errors: [],
  };

  const apiKey = oddsApiKey();
  if (!apiKey) {
    report.errors.push("THE_ODDS_API_KEY not configured");
    return report;
  }

  const now = new Date();
  const picks = await prisma.pick.findMany({
    where: {
      closingOdds: null,
      result: "PENDING",
      oddsApiEventId: { not: null },
      oddsApiSportKey: { not: null },
      marketKey: { not: null },
      // Kicking off soon, but not yet started.
      eventStartsAt: { gt: now, lt: new Date(now.getTime() + CAPTURE_WINDOW_MS) },
    },
    select: {
      id: true,
      odds: true,
      sport: true,
      oddsApiEventId: true,
      oddsApiSportKey: true,
      marketKey: true,
      side: true,
      linePoint: true,
      playerName: true,
    },
  });
  report.candidates = picks.length;
  if (picks.length === 0) return report;

  // One request per league, not per pick.
  const byLeague = new Map<string, typeof picks>();
  for (const pick of picks) {
    const key = pick.oddsApiSportKey!;
    byLeague.set(key, [...(byLeague.get(key) ?? []), pick]);
  }

  for (const [sportKey, leaguePicks] of byLeague) {
    const markets = [...new Set(leaguePicks.map((p) => p.marketKey!))].join(",");
    const url =
      `${API_BASE}/sports/${sportKey}/odds` +
      `?apiKey=${apiKey}&regions=eu,us&oddsFormat=american&markets=${markets}`;

    try {
      // Never cached: a closing price read from an hour-old cache is not a
      // closing price, and this is the one call where freshness is the point.
      const res = await fetch(url, { cache: "no-store" });
      report.leaguesFetched += 1;
      if (!res.ok) {
        report.errors.push(`${sportKey}: HTTP ${res.status}`);
        continue;
      }
      const events = (await res.json()) as ApiEvent[];
      const byId = new Map(events.map((e) => [e.id, e]));

      for (const pick of leaguePicks) {
        const event = byId.get(pick.oddsApiEventId!);
        const price = event ? findClosingPrice(event, pick) : null;
        if (price == null) {
          report.unmatched += 1;
          continue;
        }
        if (!opts.dryRun) {
          await prisma.pick.update({
            where: { id: pick.id },
            data: { closingOdds: price, closingOddsAt: new Date() },
          });
        }
        report.captured += 1;
      }
    } catch (e) {
      report.errors.push(`${sportKey}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return report;
}

/** Sports whose picks are worth capturing — everything the board prices. */
export function isCapturableSport(sport: PickSport): boolean {
  return sport !== "OTHER";
}
