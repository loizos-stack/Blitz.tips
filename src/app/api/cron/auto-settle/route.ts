import { NextResponse } from "next/server";
import { runAutoSettle } from "@/lib/auto-settle";
import { requireAdmin } from "@/lib/admin";

export const maxDuration = 60;

/**
 * Grades pending schedule picks from final scores. Invoked by the Vercel cron
 * (authorized via CRON_SECRET, which Vercel sends automatically once the env
 * var exists) or manually by an admin from the panel.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requireAdmin());
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runAutoSettle();
  return NextResponse.json(report);
}
