import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { grantAccessPass } from "@/lib/access-pass";
import { formatDate } from "@/lib/date-format";

/**
 * Confirm or reject an off-platform payment.
 *
 * This is the step that actually sells the pass, so it is the step that has
 * to be careful. Nothing is granted until a person says the money arrived,
 * and the decision is recorded with who made it — there is no webhook to
 * appeal to afterwards, so the audit trail is the only record of why someone
 * has access.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("financials");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = body?.decision === "reject" ? "reject" : body?.decision === "confirm" ? "confirm" : null;
  if (!decision) {
    return NextResponse.json({ error: "Say confirm or reject." }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  const payment = await prisma.directPayment.findUnique({ where: { id } });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  // Confirming twice would extend the pass twice for one transfer.
  if (payment.status !== "PENDING") {
    return NextResponse.json(
      { error: `This payment was already ${payment.status.toLowerCase()}.` },
      { status: 409 }
    );
  }

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { id: payment.handicapperId },
    select: { handle: true, displayName: true },
  });

  if (decision === "reject") {
    await prisma.directPayment.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedById: ctx.session.user.id,
        decidedByEmail: ctx.session.user.email ?? null,
        rejectedReason: reason || null,
      },
    });
    await prisma.notification
      .create({
        data: {
          userId: payment.subscriberId,
          type: "direct.rejected",
          title: "We couldn't match your payment",
          body: reason
            ? `Reference ${payment.reference}: ${reason}`
            : `We couldn't find a payment matching reference ${payment.reference}. Get in touch and we'll sort it out.`,
          url: "/contact",
        },
      })
      .catch(() => null);
    await logAdmin(
      ctx.session,
      "direct.reject",
      "DirectPayment",
      id,
      `${payment.reference}${reason ? `; ${reason}` : ""}`
    );
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const periodEnd = await grantAccessPass({
    subscriberId: payment.subscriberId,
    handicapperId: payment.handicapperId,
    interval: payment.interval,
  });

  await prisma.directPayment.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      decidedAt: new Date(),
      decidedById: ctx.session.user.id,
      decidedByEmail: ctx.session.user.email ?? null,
    },
  });

  await prisma.notification
    .create({
      data: {
        userId: payment.subscriberId,
        type: "direct.confirmed",
        title: "Payment received",
        body: `Your pass to ${handicapper?.displayName ?? "the handicapper"} is active until ${formatDate(periodEnd)}.`,
        url: handicapper ? `/handicappers/${handicapper.handle}` : null,
        handicapperId: payment.handicapperId,
      },
    })
    .catch(() => null);

  await logAdmin(
    ctx.session,
    "direct.confirm",
    "DirectPayment",
    id,
    `${payment.reference}; ${payment.interval} pass to @${handicapper?.handle ?? payment.handicapperId}; ${(payment.amountCents / 100).toFixed(2)} ${payment.currency}; owed ${(payment.netCents / 100).toFixed(2)}`
  );

  return NextResponse.json({ ok: true, status: "CONFIRMED", until: periodEnd.toISOString() });
}
