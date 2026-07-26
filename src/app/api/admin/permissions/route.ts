import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAdmin } from "@/lib/audit";
import {
  requireSuperAdmin,
  isSuperAdminEmail,
  GRANTABLE_PERMISSIONS,
  type AdminPermission,
} from "@/lib/permissions";

const GRANTABLE_KEYS = new Set<string>(GRANTABLE_PERMISSIONS.map((p) => p.key));

function cleanPermissions(input: unknown): AdminPermission[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: AdminPermission[] = [];
  for (const v of input) {
    if (typeof v === "string" && GRANTABLE_KEYS.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v as AdminPermission);
    }
  }
  return out;
}

// List every admin and their permissions (superadmin only).
export async function GET() {
  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "Superadmin only" }, { status: 403 });

  const admins = await prisma.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { isSuperAdmin: true }] },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperAdmin: true,
      adminPermissions: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    admins: admins.map((a) => ({
      ...a,
      // Env-bootstrapped superadmins are controlled by ADMIN_EMAILS /
      // SUPERADMIN_EMAILS and can't be edited or revoked from the UI.
      locked: isSuperAdminEmail(a.email),
      isSelf: a.id === ctx.userId,
    })),
  });
}

// Promote an existing user to admin (by email) with a set of permissions.
export async function POST(request: Request) {
  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "Superadmin only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const makeSuper = body.isSuperAdmin === true;
  const permissions = cleanPermissions(body.permissions);

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!makeSuper && permissions.length === 0) {
    return NextResponse.json({ error: "Pick at least one permission" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    return NextResponse.json(
      { error: "No account with that email — they need to sign up first." },
      { status: 404 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ADMIN",
      isSuperAdmin: makeSuper,
      adminPermissions: makeSuper ? [] : permissions,
    },
  });
  await logAdmin(
    ctx.session,
    "admin.grant",
    "User",
    user.id,
    makeSuper ? "superadmin" : permissions.join(", ")
  );
  return NextResponse.json({ ok: true });
}

// Update an existing admin's permissions or superadmin flag.
export async function PATCH(request: Request) {
  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "Superadmin only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing admin id" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isSuperAdmin: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isSuperAdminEmail(target.email)) {
    return NextResponse.json({ error: "This superadmin is set via env and can't be edited here." }, { status: 400 });
  }

  const makeSuper = typeof body.isSuperAdmin === "boolean" ? body.isSuperAdmin : target.isSuperAdmin;
  // Guard against a superadmin dropping their own last bit of access by mistake.
  if (id === ctx.userId && !makeSuper) {
    return NextResponse.json({ error: "You can't remove your own superadmin here." }, { status: 400 });
  }

  const permissions = cleanPermissions(body.permissions);
  if (!makeSuper && permissions.length === 0) {
    return NextResponse.json({ error: "Pick at least one permission, or revoke this admin." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id },
    data: {
      role: "ADMIN",
      isSuperAdmin: makeSuper,
      adminPermissions: makeSuper ? [] : permissions,
    },
  });
  await logAdmin(
    ctx.session,
    "admin.update",
    "User",
    id,
    makeSuper ? "superadmin" : permissions.join(", ")
  );
  return NextResponse.json({ ok: true });
}

// Revoke admin access entirely, reverting the account to its normal role.
export async function DELETE(request: Request) {
  const ctx = await requireSuperAdmin();
  if (!ctx) return NextResponse.json({ error: "Superadmin only" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing admin id" }, { status: 400 });
  if (id === ctx.userId) {
    return NextResponse.json({ error: "You can't revoke your own admin access." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true, handicapper: { select: { id: true } } },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isSuperAdminEmail(target.email)) {
    return NextResponse.json({ error: "This superadmin is set via env and can't be revoked here." }, { status: 400 });
  }

  // Keep handicappers as handicappers; everyone else drops to subscriber.
  await prisma.user.update({
    where: { id },
    data: {
      role: target.handicapper ? "HANDICAPPER" : "SUBSCRIBER",
      isSuperAdmin: false,
      adminPermissions: [],
    },
  });
  await logAdmin(ctx.session, "admin.revoke", "User", id, target.email);
  return NextResponse.json({ ok: true });
}
