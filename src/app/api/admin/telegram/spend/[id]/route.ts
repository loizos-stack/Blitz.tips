import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Remove a ledger row. Hand-typed data needs a way to correct a typo. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("telegram");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const entry = await prisma.adSpendEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.adSpendEntry.delete({ where: { id } });

  // Logged with the figures, so a deleted row is still reconstructable from the
  // audit trail — this is the only record of that spend.
  await logAdmin(
    ctx.session,
    "adspend.delete",
    "AdSpendEntry",
    id,
    `${entry.platform} · ${entry.campaign} · ${(entry.spendCents / 100).toFixed(2)} ${entry.currency}`
  );

  return NextResponse.json({ ok: true });
}
