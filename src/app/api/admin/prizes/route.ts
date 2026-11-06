import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { monthLabel, recordMonth } from "@/lib/monthly-prizes";

export const dynamic = "force-dynamic";

/**
 * Recording a month's winners, and marking each one paid.
 *
 * Its own `prizes` permission. Reusing `contests` was the first instinct —
 * same job, settle a standing and pay the winners — but two catalog entries
 * sharing one key renders two checkboxes on the Permissions tab that silently
 * write the same grant.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("prizes");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "record") {
    const month = String(body.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "A month like 2026-11 is required." }, { status: 400 });
    }
    const res = await recordMonth(month);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 400 });
    await logAdmin(
      ctx.session,
      "prizes.record",
      "MonthlyPrizeAward",
      month,
      `Recorded ${res.recorded} winner(s) for ${monthLabel(month)}`
    );
    return NextResponse.json({ ok: true, recorded: res.recorded });
  }

  if (action === "paid") {
    const id = String(body.id ?? "");
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;
    const award = await prisma.monthlyPrizeAward.findUnique({ where: { id } });
    if (!award) return NextResponse.json({ error: "No such award." }, { status: 404 });

    // A toggle, so a mis-click is undoable. Paying twice is the expensive
    // mistake here; being unable to correct the record is the annoying one.
    const paidAt = award.paidAt ? null : new Date();
    await prisma.monthlyPrizeAward.update({
      where: { id },
      data: { paidAt, paidNote: paidAt ? note : null },
    });
    await logAdmin(
      ctx.session,
      "prizes.paid",
      "MonthlyPrizeAward",
      id,
      `${paidAt ? "Marked paid" : "Un-marked paid"}: ${monthLabel(award.month)} #${award.rank}, ${(award.prizeCents / 100).toFixed(2)}`
    );
    return NextResponse.json({ ok: true, paid: paidAt !== null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
