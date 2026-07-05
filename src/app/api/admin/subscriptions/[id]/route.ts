import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("subscriptions");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as "cancel" | "refund" | undefined;

  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No Stripe subscription on record" }, { status: 404 });
  }

  try {
    if (action === "cancel") {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      await prisma.subscription.update({ where: { id }, data: { status: "CANCELED" } });
      await logAdmin(session, "subscription.cancel", "Subscription", id, sub.stripeSubscriptionId);
      return NextResponse.json({ ok: true, message: "Subscription canceled" });
    }

    if (action === "refund") {
      // Refund the most recent paid invoice. reverse_transfer pulls the funds
      // back from the handicapper's connected account, and refunding the
      // application fee returns the platform's cut too — the subscriber is
      // made whole and neither side keeps money from the refunded period.
      const invoices = await stripe.invoices.list({
        subscription: sub.stripeSubscriptionId,
        status: "paid",
        limit: 1,
      });
      const invoice = invoices.data[0] as
        | (Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null })
        | undefined;
      const paymentIntent = invoice?.payment_intent;
      const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
      if (!paymentIntentId) {
        return NextResponse.json({ error: "No paid invoice found to refund" }, { status: 404 });
      }
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
      });
      await logAdmin(session, "subscription.refund", "Subscription", id, paymentIntentId);
      return NextResponse.json({ ok: true, message: "Last payment refunded" });
    }
  } catch (error) {
    console.error("Admin subscription action failed:", error);
    const message = error instanceof Error ? error.message : "Stripe call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
