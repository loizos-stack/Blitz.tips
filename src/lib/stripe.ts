import Stripe from "stripe";
import type { BillingInterval, HandicapperPlan } from "@prisma/client";
import { PLAN_DEFINITIONS } from "@/lib/plans";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn("STRIPE_SECRET_KEY is not set — Stripe features will fail until it is configured.");
}

export const stripe = new Stripe(secretKey ?? "sk_test_missing", {
  apiVersion: "2026-06-24.dahlia",
});

const PLAN_PRODUCT_NAMES: Partial<Record<HandicapperPlan, string>> = {
  SILVER: "Blitz.tips Silver Plan",
  GOLD: "Blitz.tips Gold Plan",
};

/**
 * Finds or creates the (single, shared-across-all-handicappers) Stripe Price
 * for a paid plan tier + billing interval, keyed by a stable lookup_key so
 * repeated calls never create duplicate Price/Product objects. This is
 * platform revenue — no Stripe Connect destination involved, unlike the
 * per-handicapper subscriber pricing in /api/stripe/checkout.
 */
export async function getOrCreatePlanPrice(plan: HandicapperPlan, interval: BillingInterval): Promise<string> {
  const definition = PLAN_DEFINITIONS[plan];
  const amount = interval === "ANNUAL" ? definition.annualPriceCents : definition.monthlyPriceCents;
  if (!amount) throw new Error(`Plan ${plan} has no price for interval ${interval}`);

  const lookupKey = `blitz_${plan.toLowerCase()}_${interval.toLowerCase()}`;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const product = await stripe.products.create({
    name: PLAN_PRODUCT_NAMES[plan] ?? `Blitz.tips ${definition.label} Plan`,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval: interval === "ANNUAL" ? "year" : "month" },
    lookup_key: lookupKey,
  });

  return price.id;
}
