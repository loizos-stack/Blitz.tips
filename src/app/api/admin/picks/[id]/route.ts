import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { formatOdds, unitProfit } from "@/lib/odds";
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

/** Signed units, the way the site writes them everywhere else. */
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}u`;

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
    select: {
      matchup: true,
      selection: true,
      playerName: true,
      linePoint: true,
      odds: true,
      // Not editable here, but both feed the profit this correction moves.
      units: true,
      result: true,
    },
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

  // What the price change actually did to the record. Units won is computed
  // from odds on every read, so this is not a second write — it is the same
  // arithmetic the leaderboard is about to do, said out loud in the audit log
  // and handed back to the admin who made the change.
  const repricedFrom = unitProfit(before.odds, before.units, before.result);
  const repricedTo = unitProfit(after.odds, before.units, before.result);
  const profitMoved = changed.includes("odds") && repricedTo !== repricedFrom;

  const detail = changed
    .map((k) =>
      k === "odds"
        ? `odds: ${formatOdds(before.odds)} → ${formatOdds(after.odds)}`
        : `${k}: ${shown(before[k])} → ${shown(data[k])}`
    )
    .join("; ");

  await logAdmin(
    session,
    "pick.correct",
    "Pick",
    id,
    profitMoved
      ? `${detail}; units won: ${signed(repricedFrom)} → ${signed(repricedTo)}`
      : detail
  );

  // The figures are cached for a minute and tagged "handicappers". Without
  // this the leaderboard, the directory and the profile would keep serving the
  // old price's profit for up to 60 seconds after the correction was saved,
  // which is exactly the window in which someone checks whether it worked.
  //
  // `expire: 0` rather than the "max" profile the docs suggest: "max" is
  // stale-while-revalidate, which would serve the old number once more before
  // refreshing. This is a read-your-own-writes case — the admin saves a price
  // and looks straight at the board — so the next read waits for fresh data.
  // updateTag(), which is built for exactly this, is Server-Actions-only and
  // cannot be called from a route handler.
  if (changed.includes("odds")) revalidateTag("handicappers", { expire: 0 });

  return NextResponse.json({
    ok: true,
    ...(profitMoved
      ? { unitsWon: { from: repricedFrom, to: repricedTo } }
      : {}),
  });
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
