import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

// Toggle an entry's payout status (paid / not paid). Used after settling to
// track which winners have actually been sent their prize.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("contests");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const paid = Boolean(body.paid);

  const entry = await prisma.contestEntry.update({
    where: { id },
    data: { paidAt: paid ? new Date() : null },
  });

  await logAdmin(ctx.session, "contest.payout", "ContestEntry", id, paid ? "marked paid" : "marked unpaid");
  return NextResponse.json({ entry });
}
