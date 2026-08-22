import { NextResponse } from "next/server";
import { runBlitzOdds, getWatchSettings } from "@/lib/blitz-odds-poll";
import { notifyDrops, pendingDrops } from "@/lib/blitz-odds-notify";
import { requirePermission } from "@/lib/permissions";

// A cycle fans out one request per watched league plus one per deepened event.
// The platform default is not enough for a full slate.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * One Blitz Odds cycle: poll the feed, detect drops, deliver alerts.
 *
 * Authorized either by CRON_SECRET (the scheduler) or by an admin holding the
 * `odds` permission (the panel's "Run now" button).
 *
 * SCHEDULING. This needs to run every few minutes to be worth anything, and
 * Vercel's Hobby plan caps crons at one run per day — so the schedule lives in
 * .github/workflows/blitz-odds.yml instead, the same arrangement auto-settle
 * already uses. Be aware that GitHub's scheduler is best-effort and routinely
 * runs late under load; a cycle nominally every 5 minutes can arrive 10-15
 * minutes apart. That matters for a tool whose whole job is to beat a kickoff,
 * and it is the strongest argument for Vercel Pro if this proves useful.
 *
 * Delivery is separated from detection: drops are committed by runBlitzOdds
 * before anything is sent, and anything undelivered from an earlier cycle is
 * picked up here. A Telegram outage therefore delays alerts rather than losing
 * them.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("odds"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runBlitzOdds();

  // Includes anything a previous cycle detected but failed to send.
  const settings = await getWatchSettings();
  const outstanding = await pendingDrops();
  const delivery = await notifyDrops(outstanding, settings);

  return NextResponse.json({ ...report, delivered: delivery });
}
