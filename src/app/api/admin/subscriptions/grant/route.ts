import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

// Superadmin-only: comp a customer a subscription to a handicapper (no payment).
// Mirrors a crypto pass — ACTIVE with a future period end and no auto-renew.
export async function POST(request: Request) {
  const ctx = await requirePermission("subscriptions");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Superadmins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const handle = typeof body.handle === "string" ? body.handle.trim().replace(/^@/, "") : "";
  // Length of the comped access in days; 0 (or blank) means an open-ended comp.
  const rawDays = Number(body.days);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 3650) : 3650;

  if (!email || !handle) {
    return NextResponse.json({ error: "Enter the customer's email and the handicapper's handle" }, { status: 400 });
  }

  const [user, handicapper] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true, email: true } }),
    prisma.handicapperProfile.findUnique({ where: { handle }, select: { id: true, userId: true, handle: true } }),
  ]);
  if (!user) return NextResponse.json({ error: "No customer with that email" }, { status: 404 });
  if (!handicapper) return NextResponse.json({ error: "No handicapper with that handle" }, { status: 404 });
  if (handicapper.userId === user.id) {
    return NextResponse.json({ error: "A handicapper can't subscribe to themselves" }, { status: 400 });
  }

  const currentPeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { subscriberId_handicapperId: { subscriberId: user.id, handicapperId: handicapper.id } },
    create: {
      subscriberId: user.id,
      handicapperId: handicapper.id,
      status: "ACTIVE",
      currentPeriodEnd,
      cancelAtPeriodEnd: true,
    },
    update: { status: "ACTIVE", currentPeriodEnd, cancelAtPeriodEnd: true },
  });

  await logAdmin(
    ctx.session,
    "subscription.grant",
    "Subscription",
    `${user.email}→@${handicapper.handle}`,
    `Comped ${days >= 3650 ? "open-ended" : `${days}-day`} access`
  );

  return NextResponse.json({ ok: true, message: `Subscribed ${user.email} to @${handicapper.handle}` });
}
