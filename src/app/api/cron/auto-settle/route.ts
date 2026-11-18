import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { runAutoSettle } from "@/lib/auto-settle";
import { requirePermission } from "@/lib/permissions";

export const maxDuration = 60;

/**
 * Grades pending picks — both handicapper picks and contest picks — from the
 * odds feed's final scores. Invoked by the Vercel cron (authorized via
 * CRON_SECRET, which Vercel sends automatically once the env var exists) or
 * manually by an admin from the panel.
 *
 * Running this several times a day:
 *   Vercel's Hobby plan caps crons at one run per day, so vercel.json is set to
 *   a single 04:00 UTC run. To grade 2-3x daily, either
 *     a) upgrade to Pro and set the schedule to "0 4,12,20 * * *", or
 *     b) leave the plan alone and point any external scheduler (cron-job.org,
 *        GitHub Actions, an uptime pinger) at this URL with the header
 *        `Authorization: Bearer $CRON_SECRET`.
 *   The sweep is idempotent — it only touches picks still PENDING whose game has
 *   finished — so extra runs are safe and simply grade whatever is newly final.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runAutoSettle();

  // Grading a pick changes every public record on the site — the leaderboard
  // rows, the directory and the monthly prize standings are all cached under
  // this tag. Without this they stay up to a minute behind the result that has
  // just been written, which is the one kind of staleness a site selling
  // verified records should not ship. `expire: 0` makes the next read see the
  // new figures rather than serving stale while it refreshes.
  if (report.settled > 0) revalidateTag("handicappers", { expire: 0 });

  return NextResponse.json(report);
}
