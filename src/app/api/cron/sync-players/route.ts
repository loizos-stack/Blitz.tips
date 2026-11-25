import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { SYNC_LEAGUES, syncPlayersForSport, type SyncReport } from "@/lib/player-sync";
import type { PickSport } from "@prisma/client";

export const maxDuration = 60;

/**
 * Refills the Player table from ESPN, so prop cards can show a player's face.
 *
 * Authorized exactly like auto-settle: the CRON_SECRET bearer token, or an
 * admin with the `system` permission. Same shape on purpose — this is the
 * second job that has to be runnable both from a schedule and by hand, and a
 * second convention for that would be one too many.
 *
 * Not on a schedule. Rosters turn over once a season, the whole sweep is a few
 * dozen requests, and a quiet half-failure in a nightly job would show up as
 * photos silently disappearing rather than as an alert.
 *
 * One league per request, chosen with ?sport=NBA. Doing all five in one
 * invocation risks the 60s budget — the NFL list alone is 21 pages — and a
 * timeout halfway through would leave some leagues synced and others not, with
 * no way to tell which from the response. Omitting the parameter syncs them
 * all and is fine from a command line, where there is no time limit.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get("sport")?.toUpperCase();
  const known = Object.keys(SYNC_LEAGUES) as PickSport[];

  if (requested && !known.includes(requested as PickSport)) {
    return NextResponse.json(
      { error: `${requested} has no ESPN headshots. Available: ${known.join(", ")}` },
      { status: 400 }
    );
  }

  const sports = requested ? [requested as PickSport] : known;

  const reports: SyncReport[] = [];
  const errors: string[] = [];
  for (const sport of sports) {
    try {
      reports.push(await syncPlayersForSport(sport));
    } catch (error) {
      // One league failing should not lose the ones that worked — the report
      // says which did what, and a re-run is harmless.
      errors.push(`${sport}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json({ reports, errors }, { status: errors.length && !reports.length ? 502 : 200 });
}
