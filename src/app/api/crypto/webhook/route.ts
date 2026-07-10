import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, PASS_DAYS } from "@/lib/coinbase";
import { logActivity } from "@/lib/audit";

// Coinbase Commerce webhook: activates the access pass when a charge confirms.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-cc-webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { code?: string } } = {};
  try {
    event = JSON.parse(raw).event ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const code = event.data?.code;
  if (!code) return NextResponse.json({ received: true });

  // charge:resolved covers charges confirmed after a delay/underpayment fix.
  if (event.type === "charge:confirmed" || event.type === "charge:resolved") {
    const payment = await prisma.cryptoPayment.findUnique({ where: { chargeCode: code } });
    if (payment && payment.status !== "CONFIRMED") {
      await prisma.cryptoPayment.update({
        where: { id: payment.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      // Extend from the current pass end when one is still running, otherwise
      // from now. Marked cancelAtPeriodEnd since crypto passes never auto-renew.
      const existing = await prisma.subscription.findUnique({
        where: {
          subscriberId_handicapperId: {
            subscriberId: payment.subscriberId,
            handicapperId: payment.handicapperId,
          },
        },
      });
      const base =
        existing?.status === "ACTIVE" &&
        !existing.stripeSubscriptionId &&
        existing.currentPeriodEnd &&
        existing.currentPeriodEnd > new Date()
          ? existing.currentPeriodEnd
          : new Date();
      const periodEnd = new Date(base.getTime() + PASS_DAYS[payment.interval] * 24 * 60 * 60 * 1000);

      await prisma.subscription.upsert({
        where: {
          subscriberId_handicapperId: {
            subscriberId: payment.subscriberId,
            handicapperId: payment.handicapperId,
          },
        },
        create: {
          subscriberId: payment.subscriberId,
          handicapperId: payment.handicapperId,
          status: "ACTIVE",
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: true,
        },
        update: {
          status: "ACTIVE",
          stripeSubscriptionId: null,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: true,
        },
      });

      const handicapper = await prisma.handicapperProfile.findUnique({
        where: { id: payment.handicapperId },
        select: { handle: true, displayName: true },
      });
      await prisma.notification.create({
        data: {
          userId: payment.subscriberId,
          type: "crypto.pass",
          title: "Crypto payment confirmed",
          body: `Your pass to ${handicapper?.displayName ?? "the handicapper"} is active until ${periodEnd.toLocaleDateString()}.`,
          url: handicapper ? `/handicappers/${handicapper.handle}` : null,
          handicapperId: payment.handicapperId,
        },
      }).catch(() => null);

      await logActivity({
        actorId: payment.subscriberId,
        action: "crypto.pass.confirmed",
        targetType: "CryptoPayment",
        targetId: payment.id,
        detail: `${payment.interval} pass → handicapper ${payment.handicapperId} ($${(payment.amountCents / 100).toFixed(2)})`,
      });
    }
  } else if (event.type === "charge:failed") {
    await prisma.cryptoPayment
      .updateMany({ where: { chargeCode: code, status: "PENDING" }, data: { status: "EXPIRED" } })
      .catch(() => null);
  }

  return NextResponse.json({ received: true });
}
