import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { runPlayerProps } from "@/lib/player-props-poll";
import { upstreamFailed } from "@/lib/api-status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run one cycle by hand.
 *
 * POST rather than GET because this spends real credits: nothing that costs
 * money should be reachable by a page load, a prefetch or a refresh.
 */
export async function POST() {
  const ctx = await requirePermission("props");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const report = await runPlayerProps();

  await logAdmin(
    ctx.session,
    "props.run",
    "PropPollRun",
    "manual",
    `Manual cycle: ${report.credits} credits, ${report.eventsSeen} events, ${report.signalsFound} signals`
  );

  // Not a 502 — see lib/api-status: Cloudflare replaces that body with its own
  // page and the real reason never reaches the browser.
  if (report.error && report.eventsSeen === 0) return upstreamFailed(report.error);

  return NextResponse.json(report);
}
