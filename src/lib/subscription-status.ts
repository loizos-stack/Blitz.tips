import type { Subscription } from "@prisma/client";

/**
 * Whether a subscription row currently grants access. Stripe-billed
 * subscriptions are ACTIVE until Stripe's webhooks say otherwise. Crypto
 * passes (no stripeSubscriptionId) additionally require their period end to be
 * in the future, so access cuts off on time even between daily cron sweeps.
 */
export function isSubscriptionActive(
  sub: Pick<Subscription, "status" | "stripeSubscriptionId" | "currentPeriodEnd"> | null | undefined
): boolean {
  if (!sub || sub.status !== "ACTIVE") return false;
  if (sub.stripeSubscriptionId) return true;
  return Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd > new Date());
}
