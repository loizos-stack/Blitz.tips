import { NextResponse } from "next/server";
import { sweepCompedPlans } from "@/lib/comped-plans";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// Sends one email per affected handicapper; a busy day is still a short list,
// but the default 10s is not worth risking against a slow mail API.
export const maxDuration = 60;

/**
 * Daily sweep for comped plans: warn the ones ending in three days, and return
 * the ones that have ended to Free.
 *
 * DAILY IS THE RIGHT CADENCE, and not just the only one this plan allows. A
 * comp is measured in days, so the worst error a daily pass can make is
 * ending a plan a few hours late — nobody is harmed by holding Gold slightly
 * too long, and the warning email names a date rather than a countdown.
 *
 * Runs at 08:00 UTC, after expire-passes at 07:30, so the two mail-sending
 * sweeps don't compete for the same rate limit.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron && !(await requirePermission("handicappers"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await sweepCompedPlans();
  return NextResponse.json(report);
}
