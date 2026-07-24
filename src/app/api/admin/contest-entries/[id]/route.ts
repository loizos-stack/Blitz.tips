import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

// Update an entry's payout or disqualification status. Body may include:
//   { paid: boolean }                       — mark a winner paid / unpaid
//   { disqualified: boolean, reason?: str } — DQ (fraud) or reinstate an entry
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAnyPermission(["contests", "integrity"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (typeof body.disqualified === "boolean") {
    const dq = body.disqualified;
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 300) : null;
    const entry = await prisma.contestEntry.update({
      where: { id },
      data: {
        disqualifiedAt: dq ? new Date() : null,
        disqualifiedReason: dq ? reason : null,
        // A disqualified entry can't be owed a payout.
        ...(dq ? { prizeCents: null, finalRank: null, paidAt: null } : {}),
      },
    });
    await logAdmin(ctx.session, "contest.disqualify", "ContestEntry", id, dq ? `DQ${reason ? `: ${reason}` : ""}` : "reinstated");
    return NextResponse.json({ entry });
  }

  const paid = Boolean(body.paid);
  const entry = await prisma.contestEntry.update({
    where: { id },
    data: { paidAt: paid ? new Date() : null },
  });
  await logAdmin(ctx.session, "contest.payout", "ContestEntry", id, paid ? "marked paid" : "marked unpaid");
  return NextResponse.json({ entry });
}

// Remove an entry entirely — used when someone opted in by mistake. Unlike a
// disqualification (which keeps the record), this deletes the entry and, by
// cascade, all of its picks and IP logs, so the user's opt-in is fully reset and
// they can join the contest again from scratch.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAnyPermission(["contests", "integrity"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.contestEntry.findUnique({
    where: { id },
    select: { user: { select: { username: true, name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  await prisma.contestEntry.delete({ where: { id } });
  const who = existing.user.username ?? existing.user.name ?? "entrant";
  await logAdmin(ctx.session, "contest.remove", "ContestEntry", id, `removed ${who} (opt-in reset)`);
  return NextResponse.json({ ok: true });
}
