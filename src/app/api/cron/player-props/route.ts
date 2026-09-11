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
 * SCHEDULING. .github/workflows/player-props.yml calls this every POLL_MINUTES.
 * Not a Vercel cron: this account is on Hobby, which rejects any schedule more
 * frequent than daily and fails the deploy rather than degrading quietly — and
 * a watcher for clusters inside a ten-minute window is worth nothing once a
 * day. Any external pinger works equally well; it needs only
 * `Authorization: Bearer $CRON_SECRET`.
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
