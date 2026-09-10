import { NextResponse } from "next/server";
import { runPlayerProps, POLL_MINUTES } from "@/lib/player-props-poll";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// A cycle fans out one request per watched event, plus the free schedule reads.
export const maxDuration = 60;

/**
 * One Player Props cycle.
 *
 * Authorized either by CRON_SECRET (which Vercel sends automatically once the
 * env var exists) or by an admin holding the `props` permission.
 *
 * SCHEDULING. vercel.json runs this every POLL_MINUTES. A watcher whose whole
 * purpose is to catch a cluster of moves inside a ten-minute window is worth
 * nothing on a daily cron, so if this account is on a plan that only allows one
 * cron run per day, either move the schedule to an external pinger against this
 * URL with `Authorization: Bearer $CRON_SECRET`, or the tool will only ever
 * report what the manual button finds. The panel's spend projection assumes the
 * configured cadence actually runs.
 *
 * Safe to call more often than scheduled: an extra cycle costs credits but
 * cannot double-report, because a cluster already raised inside the window is
 * suppressed rather than written again.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron && !(await requirePermission("props"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runPlayerProps();
  return NextResponse.json({ ...report, pollMinutes: POLL_MINUTES });
}
