import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn("STRIPE_SECRET_KEY is not set — Stripe features will fail until it is configured.");
}

export const stripe = new Stripe(secretKey ?? "sk_test_missing", {
  apiVersion: "2026-06-24.dahlia",
});

export const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? "15");
