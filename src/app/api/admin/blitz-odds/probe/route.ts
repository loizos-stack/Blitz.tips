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
 */
export async function POST() {
  const ctx = await requirePermission("odds");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  return NextResponse.json(await probeRundown());
}
