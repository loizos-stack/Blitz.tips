import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIpnSignature, PASS_DAYS } from "@/lib/nowpayments";
import { logActivity } from "@/lib/audit";

// NOWPayments IPN callback: activates the access pass when a payment finishes.
export async function POST(request: Request) {
  let body: {
    payment_status?: string;
    order_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!verifyIpnSignature(body, request.headers.get("x-nowpayments-sig"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const orderId = body.order_id;
  const status = body.payment_status;
  if (!orderId || !status) return NextResponse.json({ received: true });

  // "finished" = fully paid and settled to the merchant balance.
  if (status === "finished") {
    const payment = await prisma.cryptoPayment.findUnique({ where: { chargeCode: orderId } });
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
      await prisma.notification
        .create({
          data: {
            userId: payment.subscriberId,
            type: "crypto.pass",
            title: "Crypto payment confirmed",
            body: `Your pass to ${handicapper?.displayName ?? "the handicapper"} is active until ${periodEnd.toLocaleDateString()}.`,
            url: handicapper ? `/handicappers/${handicapper.handle}` : null,
            handicapperId: payment.handicapperId,
          },
        })
        .catch(() => null);

      await logActivity({
        actorId: payment.subscriberId,
        action: "crypto.pass.confirmed",
        targetType: "CryptoPayment",
        targetId: payment.id,
        detail: `${payment.interval} pass → handicapper ${payment.handicapperId} ($${(payment.amountCents / 100).toFixed(2)})`,
      });
    }
  } else if (status === "failed" || status === "expired" || status === "refunded") {
    await prisma.cryptoPayment
      .updateMany({ where: { chargeCode: orderId, status: "PENDING" }, data: { status: "EXPIRED" } })
      .catch(() => null);
  }

  return NextResponse.json({ received: true });
}
