import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { runBlitzOdds, getWatchSettings } from "@/lib/blitz-odds-poll";
import { notifyDrops, pendingDrops } from "@/lib/blitz-odds-notify";
import { upstreamFailed } from "@/lib/api-status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run one cycle by hand.
 *
 * A POST rather than a GET because this spends real credits: nothing that costs
 * money should be reachable by a page load, a prefetch, or a refresh.
 */
export async function POST() {
  const ctx = await requirePermission("odds");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const report = await runBlitzOdds();
  const settings = await getWatchSettings();
  const delivery = await notifyDrops(await pendingDrops(), settings);

  await logAdmin(
    ctx.session,
    "odds.run",
    "OddsPollRun",
    "manual",
    `Manual cycle: ${report.credits} credits, ${report.eventsSeen} events, ${report.dropsFound} drops`
  );

  // Not 502 — see lib/api-status: Cloudflare replaces that body with its own
  // page and the real reason never reaches the browser.
  if (report.error) return upstreamFailed(report.error);

  return NextResponse.json({ ...report, delivered: delivery });
}
