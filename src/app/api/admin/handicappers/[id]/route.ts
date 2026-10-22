import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

const PLANS = ["FREE", "SILVER", "GOLD"] as const;
type Plan = (typeof PLANS)[number];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // The Media tab moderates images via this route, so either permission grants it.
  const ctx = await requireAnyPermission(["handicappers", "media"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: {
    isVerified?: boolean;
    plan?: Plan;
    planStatus?: "ACTIVE";
    suspendedAt?: Date | null;
    avatarUrl?: null;
    coverUrl?: null;
  } = {};
  const actions: string[] = [];

  if (typeof body.isVerified === "boolean") {
    data.isVerified = body.isVerified;
    actions.push(body.isVerified ? "verify" : "unverify");
  }
  // Plan changes are NOT accepted here any more — see ./comp/route.ts.
  //
  // This used to set `plan` directly and call it a comp. It had no end date, it
  // told the handicapper nothing, and it would overwrite a live Stripe
  // subscription, leaving someone paying for a plan they had been given. A comp
  // is now a gift with a date on it, granted through the route that enforces
  // those rules. Refusing loudly rather than ignoring the field, so an old
  // client or a bookmarked script doesn't appear to succeed while changing
  // nothing.
  if (typeof body.plan === "string" && PLANS.includes(body.plan)) {
    return NextResponse.json(
      { error: "Plans are granted as timed comps now — use the Give control on the Handicappers tab." },
      { status: 410 }
    );
  }
  if (typeof body.suspended === "boolean") {
    data.suspendedAt = body.suspended ? new Date() : null;
    actions.push(body.suspended ? "suspend" : "unsuspend");
  }
  // Image moderation: clear an offending upload. The blob itself is left in
  // storage (negligible cost) — the profile simply stops referencing it.
  if (body.removeAvatar === true) {
    data.avatarUrl = null;
    actions.push("removeAvatar");
  }
  if (body.removeCover === true) {
    data.coverUrl = null;
    actions.push("removeCover");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.handicapperProfile.update({ where: { id }, data });
  await logAdmin(session, "handicapper.update", "HandicapperProfile", id, actions.join(", "));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAnyPermission(["handicappers"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const profile = await prisma.handicapperProfile.findUnique({ where: { id }, select: { userId: true, handle: true } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascades take picks and subscriptions; the user account stays and reverts
  // to a plain subscriber.
  await prisma.$transaction([
    prisma.handicapperProfile.delete({ where: { id } }),
    prisma.user.update({ where: { id: profile.userId }, data: { role: "SUBSCRIBER" } }),
  ]);
  await logAdmin(session, "handicapper.delete", "HandicapperProfile", id, `@${profile.handle}`);
  return NextResponse.json({ ok: true });
}
