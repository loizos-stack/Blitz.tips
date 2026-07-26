import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { settlePickSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("picks");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("picks");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const pick = await prisma.pick.delete({ where: { id } });
  await logAdmin(session, "pick.delete", "Pick", id, `${pick.matchup} — ${pick.selection}`);
  return NextResponse.json({ ok: true });
}
