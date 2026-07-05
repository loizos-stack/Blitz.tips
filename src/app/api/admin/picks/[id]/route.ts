import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { settlePickSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = settlePickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid result" }, { status: 400 });
  }

  await prisma.pick.update({
    where: { id },
    data: { result: parsed.data.result, settledAt: parsed.data.result === "PENDING" ? null : new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  await prisma.pick.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
