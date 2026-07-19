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
    // Handicapper plan payments (handicapper → platform) use a distinct order
    // prefix and activate the plan for one fixed term (never auto-renews).
    if (orderId.startsWith("blitzplan_")) {
      const planPayment = await prisma.planCryptoPayment.findUnique({ where: { chargeCode: orderId } });
      if (planPayment && planPayment.status !== "CONFIRMED") {
        await prisma.planCryptoPayment.update({
          where: { id: planPayment.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });

        const hc = await prisma.handicapperProfile.findUnique({
          where: { id: planPayment.handicapperId },
          select: { userId: true, planCurrentPeriodEnd: true, planStripeSubscriptionId: true },
        });
        if (hc) {
          // Extend from the current crypto plan end if one is still running (and
          // it's not a Stripe recurring plan), otherwise from now.
          const base =
            !hc.planStripeSubscriptionId &&
            hc.planCurrentPeriodEnd &&
            hc.planCurrentPeriodEnd > new Date()
              ? hc.planCurrentPeriodEnd
              : new Date();
          const days = planPayment.interval === "ANNUAL" ? 365 : 30;
          const periodEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
          const label = planPayment.plan === "GOLD" ? "Gold" : "Silver";

          await prisma.handicapperProfile.update({
            where: { id: planPayment.handicapperId },
            data: {
              plan: planPayment.plan,
              planInterval: planPayment.interval,
              planStatus: "ACTIVE",
              planStripeSubscriptionId: null,
              planCurrentPeriodEnd: periodEnd,
              planCancelAtPeriodEnd: true, // crypto plans never auto-renew
            },
          });

          await prisma.notification
            .create({
              data: {
                userId: hc.userId,
                type: "plan.crypto",
                title: `${label} plan active`,
                body: `Your crypto payment cleared — your ${label} plan is active until ${periodEnd.toLocaleDateString()}.`,
                url: "/dashboard/handicapper/plan",
              },
            })
            .catch(() => null);

          await logActivity({
            actorId: hc.userId,
            action: "plan.crypto.confirmed",
            targetType: "PlanCryptoPayment",
            targetId: planPayment.id,
            detail: `${planPayment.plan} ${planPayment.interval} via crypto ($${(planPayment.amountCents / 100).toFixed(2)})`,
          });
        }
      }
      return NextResponse.json({ received: true });
    }

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
    if (orderId.startsWith("blitzplan_")) {
      await prisma.planCryptoPayment
        .updateMany({ where: { chargeCode: orderId, status: "PENDING" }, data: { status: "EXPIRED" } })
        .catch(() => null);
    } else {
      await prisma.cryptoPayment
        .updateMany({ where: { chargeCode: orderId, status: "PENDING" }, data: { status: "EXPIRED" } })
        .catch(() => null);
    }
  }

  return NextResponse.json({ received: true });
}
