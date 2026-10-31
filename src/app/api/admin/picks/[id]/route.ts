import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { correctPickSchema, settlePickSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("picks");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Two different edits arrive here: grading a pick, and correcting what it
  // says. They are told apart by the payload rather than by separate routes so
  // the row controls all stay pointed at one URL.
  if (!(body && typeof body === "object" && "result" in body)) {
    return correctPick(session, id, body);
  }

  const parsed = settlePickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  }

  await prisma.pick.update({
    where: { id },
    data: {
      result: parsed.data.result,
      settledAt: parsed.data.result === "PENDING" ? null : new Date(),
      settledBy: parsed.data.result === "PENDING" ? null : session.user.id,
    },
  });
  await logAdmin(session, "pick.settle", "Pick", id, `result=${parsed.data.result}`);
  return NextResponse.json({ ok: true });
}

/** "—" for an absent value, so an audit line reads as a change either way. */
function shown(v: string | number | null | undefined): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

/**
 * Correct the wording of a pick.
 *
 * A handicapper cannot do this at all: `/api/picks/[id]` refuses to touch a
 * graded pick and tells them to contact support, which is what this is. The
 * correction is deliberately loud rather than silent — the before and after of
 * every field that moved goes into the admin log, because "nothing editable
 * after" is the site's central claim and an edit that leaves no trace would
 * quietly make it untrue.
 */
async function correctPick(session: Session, id: string, body: unknown) {
  const parsed = correctPickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid correction" },
      { status: 400 }
    );
  }

  const before = await prisma.pick.findUnique({
    where: { id },
    select: { matchup: true, selection: true, playerName: true, linePoint: true },
  });
  if (!before) return NextResponse.json({ error: "Pick not found" }, { status: 404 });

  const data = parsed.data;
  const after = { ...before, ...data };

  // The trap this guard exists for: swapping the player in `selection` while
  // leaving `playerName` behind would display the new player's bet and grade
  // the old player's stat line. Only checked when the text actually moved, so
  // fixing a matchup typo on a prop stays a one-field edit.
  if (
    data.selection !== undefined &&
    data.selection !== before.selection &&
    after.playerName &&
    !after.selection.toLowerCase().includes(after.playerName.toLowerCase())
  ) {
    return NextResponse.json(
      {
        error: `This pick is graded against "${after.playerName}", who the new selection no longer names. Correct the Player field too, or clear it to fall back to grading from the selection text.`,
      },
      { status: 409 }
    );
  }

  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => data[k] !== before[k]
  );
  if (changed.length === 0) return NextResponse.json({ ok: true, unchanged: true });

  await prisma.pick.update({ where: { id }, data });
  await logAdmin(
    session,
    "pick.correct",
    "Pick",
    id,
    changed.map((k) => `${k}: ${shown(before[k])} → ${shown(data[k])}`).join("; ")
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("picks");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const pick = await prisma.pick.delete({ where: { id } });
  await logAdmin(session, "pick.delete", "Pick", id, `${pick.matchup} — ${pick.selection}`);
  return NextResponse.json({ ok: true });
}
