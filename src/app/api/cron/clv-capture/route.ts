import { NextResponse } from "next/server";
import { runClvCapture } from "@/lib/clv-capture";
import { requirePermission } from "@/lib/permissions";

export const maxDuration = 60;

/**
 * Captures the closing price for picks whose game starts soon.
 *
 * Not scheduled in vercel.json on purpose. Every other odds call this site
 * makes is paid for by a page view and shared through a long cache; this one is
 * driven by kickoff times and spends whether or not anyone visits, so it should
 * be switched on deliberately once its cost has been measured rather than
 * arriving switched on.
 *
 * To run it, either add it to vercel.json's crons (hourly is the sensible
 * cadence — the capture window is 90 minutes, so hourly can't miss a game), or
 * point an external scheduler at this URL with `Authorization: Bearer
 * $CRON_SECRET`. `?dryRun=1` reports what it would capture, and how many league
 * requests that would take, without writing anything or — importantly — without
 * skipping the requests, since the request count *is* the cost being measured.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const report = await runClvCapture({ dryRun });
  return NextResponse.json({ dryRun, ...report });
}
