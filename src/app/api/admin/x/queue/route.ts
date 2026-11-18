import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { sendQueued, discardQueued, runSlot } from "@/lib/x-queue";
import { setSetting } from "@/lib/settings";
import { X_SLOTS, type XSlot } from "@/lib/x-rotation";

/**
 * The approve/discard end of the posting queue, plus the two controls that
 * change how the rotation behaves.
 *
 * Sending is deliberately a POST with an explicit id rather than anything
 * batched: approving is the step that puts words on a public account, and it
 * should take one decision per post.
 */
export async function POST(request: Request) {
  const ctx = await requireAnyPermission(["x"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "send") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing post id." }, { status: 400 });
    const result = await sendQueued(id, { by: ctx.userId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
    await logAdmin(ctx.session, "x.queue.send", "XQueuedPost", id, result.tweetId ?? "");
    return NextResponse.json({
      ok: true,
      tweetId: result.tweetId,
      detail: `Posted as @${result.username}.`,
    });
  }

  if (action === "discard") {
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing post id." }, { status: 400 });
    if (!(await discardQueued(id, ctx.userId))) {
      return NextResponse.json({ error: "That post is no longer pending." }, { status: 409 });
    }
    await logAdmin(ctx.session, "x.queue.discard", "XQueuedPost", id, "");
    return NextResponse.json({ ok: true, detail: "Discarded." });
  }

  if (action === "autoSend") {
    const on = body.value === true;
    await setSetting("x.autoSend", on ? "true" : "false");
    await logAdmin(ctx.session, "x.autoSend", "SiteSetting", "x.autoSend", on ? "on" : "off");
    return NextResponse.json({
      ok: true,
      autoSend: on,
      detail: on
        ? "Composed posts will go out without waiting for approval."
        : "Composed posts will wait here for approval.",
    });
  }

  // Compose a slot now rather than waiting for its hour — how you see what the
  // rotation would actually say before trusting it to say it. Queues even when
  // automatic posting is on: asking to see a post should not publish it.
  if (action === "preview") {
    const slot = String(body.slot ?? "");
    if (!X_SLOTS.includes(slot as XSlot)) {
      return NextResponse.json({ error: `Unknown slot "${slot}".` }, { status: 400 });
    }
    const report = await runSlot(slot as XSlot, new Date(), { autoSend: false });
    await logAdmin(ctx.session, "x.queue.preview", "XQueuedPost", slot, report.outcome);
    return NextResponse.json(report);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
