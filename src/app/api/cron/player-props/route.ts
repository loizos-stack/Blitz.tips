import { NextResponse } from "next/server";
import {
  runPlayerProps,
  emptyPropRunReport,
  withDeadline,
  POLL_MINUTES,
  HARD_RESPONSE_MS,
} from "@/lib/player-props-poll";
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
 * WHY THERE IS A SECOND TIME LIMIT HERE. The cycle budgets itself, and that
 * budget was wrong twice: it bounded when new work could START without
 * bounding how long the work already begun would take. A single event can cost
 * two requests (the 422 retry), and a busy evening can produce hundreds of
 * database writes, so the function kept running past its 60-second limit and
 * being killed — which returns a 504 and, worse, discards the report of
 * everything already bought.
 *
 * Any internal budget is a guess about how long the remaining work takes. This
 * is not: at HARD_RESPONSE_MS the route stops waiting and answers with the
 * report the cycle has filled in so far. Credits are banked to the database as
 * they are spent, so an abandoned cycle has already accounted for its own
 * spending; what is lost is at most the detection pass, and the next cycle
 * sees the same prices.
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

  // The cycle fills this in as it goes, so the timeout branch reports what was
  // really spent rather than zeros.
  const live = emptyPropRunReport();

  const report = await withDeadline(runPlayerProps(new Date(), live), HARD_RESPONSE_MS, () => {
    live.stoppedReason =
      `${live.stoppedReason ? live.stoppedReason + " " : ""}` +
      `Cut short at ${Math.round(HARD_RESPONSE_MS / 1000)}s to answer inside the function's limit — ` +
      `everything read so far is stored and counted, and the next cycle carries on.`;
    return live;
  });

  return NextResponse.json({ ...report, pollMinutes: POLL_MINUTES });
}
