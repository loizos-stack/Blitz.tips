import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

// Update an entry's payout or disqualification status. Body may include:
//   { paid: boolean }                       — mark a winner paid / unpaid
//   { disqualified: boolean, reason?: str } — DQ (fraud) or reinstate an entry
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("contests");
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
