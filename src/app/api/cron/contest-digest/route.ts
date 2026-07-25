import { NextResponse } from "next/server";
import { runContestDigest } from "@/lib/contest-digest";
import { requirePermission } from "@/lib/permissions";

export const maxDuration = 60;

/**
 * Sends the weekly Supercapper recap to every entrant (record, rank, picks left
 * to qualify, and the handicappers currently beating their number).
 *
 * Triggered by the GitHub Actions schedule in .github/workflows/contest-digest.yml
 * — Vercel's Hobby plan only allows one cron a day and that slot belongs to
 * auto-settle — or by an admin, with `?dry=1` to count recipients without
 * sending anything.
 *
 * Not idempotent: every call that lands while the contest is live sends mail.
 * Keep it on a weekly schedule and use the dry run to check the audience first.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const report = await runContestDigest({ dryRun });
  return NextResponse.json(report);
}
