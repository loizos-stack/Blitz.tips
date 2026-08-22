import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { probeRundown } from "@/lib/blitz-odds-rundown";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ask Rundown what it actually answers with.
 *
 * The adapter guesses three things it cannot check locally — the host, the
 * numeric sport ids, and the field names inside a line — and all three fail
 * identically: requests succeed, cost money, and carry nothing usable. This
 * settles all three from one live call.
 *
 * A POST, like the manual cycle, because it spends a request. It reads only —
 * nothing is written — and runs server-side so the key stays on the server.
 *
 * Authorized either by an admin holding the `odds` permission (the panel's
 * button) or by CRON_SECRET, so the answer can also be fetched from the Actions
 * tab against a deployment that has no browser session — which is the only way
 * to reach a preview build. Same authority the cron route already carries, and
 * this one cannot even write.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron && !(await requirePermission("odds"))) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  return NextResponse.json(await probeRundown());
}
