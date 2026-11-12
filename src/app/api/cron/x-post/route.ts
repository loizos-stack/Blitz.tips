import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { runSlot } from "@/lib/x-queue";
import { X_SLOTS, type XSlot } from "@/lib/x-rotation";

export const dynamic = "force-dynamic";
// Composing reads the directory and may fetch a generated card before posting.
// None of that is slow, but the default 10s leaves no room for a slow card.
export const maxDuration = 60;

/**
 * Run whichever posting slot is due.
 *
 * Called by the Cloudflare Worker in workers/x-rotation. It is a
 * Cloudflare Worker rather than a Vercel cron because this plan allows daily
 * crons only, and rejects a more frequent schedule at deploy time rather than
 * degrading quietly.
 *
 * THE SLOT IS DERIVED FROM THE CLOCK, not passed in by the caller. The Worker
 * is deployed by hand and is not covered by this repo's tests, so it knows only
 * when to ask, never what to post — changing the rotation is a change here,
 * with no Cloudflare edit and no chance of the two drifting apart. `?slot=` is
 * accepted for testing a specific slot by hand.
 *
 * Safe to call more than once in a slot: runSlot refuses a slot that already
 * ran today, because a retried firing must not become a second identical post.
 */

/** UTC hour → slot. Matches the cron triggers documented for the Worker. */
const SCHEDULE: Record<number, XSlot> = {
  12: "board", // 08:00 ET
  16: "gold", // 12:00 ET
  20: "leaderboard", // 16:00 ET
  0: "winner", // 20:00 ET
  3: "recruit", // 23:00 ET
};

/**
 * The slot for a given moment, allowing for a firing that arrives late.
 *
 * Cloudflare describes its cron as best-effort, so a trigger set for 16:00 can
 * land at 16:07. Matching the hour exactly would silently drop that post, so a
 * firing is attributed to the most recent slot hour within the last two hours.
 */
export function slotForHour(now: Date): XSlot | null {
  for (let back = 0; back <= 2; back += 1) {
    const hour = (now.getUTCHours() - back + 24) % 24;
    const slot = SCHEDULE[hour];
    if (slot) return slot;
  }
  return null;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  if (!isCron && !(await requirePermission("x"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asked = new URL(request.url).searchParams.get("slot");
  if (asked && !X_SLOTS.includes(asked as XSlot)) {
    return NextResponse.json(
      { error: `Unknown slot "${asked}". One of: ${X_SLOTS.join(", ")}.` },
      { status: 400 }
    );
  }

  const now = new Date();
  const slot = (asked as XSlot | null) ?? slotForHour(now);
  if (!slot) {
    return NextResponse.json({
      ran: false,
      detail: `No slot is due at ${now.getUTCHours()}:00 UTC.`,
    });
  }

  const report = await runSlot(slot, now);
  return NextResponse.json({ ran: true, ...report });
}
