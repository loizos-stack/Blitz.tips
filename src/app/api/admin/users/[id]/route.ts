import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

const ROLES = ["SUBSCRIBER", "HANDICAPPER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("users");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: { role?: Role; emailVerified?: Date; suspendedAt?: Date | null } = {};
  const actions: string[] = [];
  if (typeof body.role === "string" && ROLES.includes(body.role)) {
    data.role = body.role as Role;
    actions.push(`role=${body.role}`);
  }
  if (body.emailVerified === true) {
    data.emailVerified = new Date();
    actions.push("emailVerified");
  }
  if (typeof body.suspended === "boolean") {
    data.suspendedAt = body.suspended ? new Date() : null;
    actions.push(body.suspended ? "suspend" : "unsuspend");
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Don't let an admin accidentally lock themselves out from the panel.
  if (id === session.user.id && (data.suspendedAt || (data.role && data.role !== "ADMIN"))) {
    return NextResponse.json({ error: "You can't suspend or demote yourself" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data });
  await logAdmin(session, "user.update", "User", id, actions.join(", "));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("users");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account here" }, { status: 400 });
  }

  // Cascades take the handicapper profile, picks, and subscriptions with it.
  const user = await prisma.user.delete({ where: { id } });
  await logAdmin(session, "user.delete", "User", id, user.email);
  return NextResponse.json({ ok: true });
}
