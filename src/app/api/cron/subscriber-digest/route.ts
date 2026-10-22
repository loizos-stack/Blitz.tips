import { NextResponse } from "next/server";
import { runSubscriberDigest } from "@/lib/subscriber-digest";
import { requirePermission } from "@/lib/permissions";

export const maxDuration = 60;

/**
 * Sends each reader a summary of what their handicappers did in the last 24
 * hours. Authorized by CRON_SECRET (Vercel sends it automatically once the env
 * var exists) or by an admin from the panel — same gate as the auto-settler.
 *
 * `?dryRun=1` reports who *would* be emailed without sending anything, which is
 * the sane way to check a change to the copy or the audience before it goes to
 * a real list.
 *
 * Idempotent only in the sense that it's harmless to run twice within a window:
 * running it twice sends twice. It's scheduled once a day for that reason, and
 * the window is a rolling 24h rather than a calendar day so a late run doesn't
 * skip anything.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await runSubscriberDigest({ dryRun });
  return NextResponse.json({ dryRun, ...report });
}
