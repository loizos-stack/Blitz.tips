import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const ROLES = ["SUBSCRIBER", "HANDICAPPER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: { role?: Role; emailVerified?: Date } = {};
  if (typeof body.role === "string" && ROLES.includes(body.role)) data.role = body.role as Role;
  if (body.emailVerified === true) data.emailVerified = new Date();
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Don't let an admin accidentally lock themselves out from the panel.
  if (data.role && data.role !== "ADMIN" && id === session.user.id) {
    return NextResponse.json({ error: "You can't remove your own admin role" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account here" }, { status: 400 });
  }

  // Cascades take the handicapper profile, picks, and subscriptions with it.
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
