import "server-only";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type { HandicapperProfile } from "@prisma/client";

// A handicapper's subscriber-facing packages. Monthly is always offered;
// weekly and annual are optional (null cents = not offered).
export type PackageInterval = "WEEKLY" | "MONTHLY" | "ANNUAL";

export const PACKAGE_INTERVALS: PackageInterval[] = ["WEEKLY", "MONTHLY", "ANNUAL"];

const PACKAGE_CONFIG: Record<
  PackageInterval,
  {
    centsField: "weeklyPriceCents" | "monthlyPriceCents" | "annualPriceCents";
    priceIdField: "stripeWeeklyPriceId" | "stripePriceId" | "stripeAnnualPriceId";
    stripeInterval: "week" | "month" | "year";
  }
> = {
  WEEKLY: { centsField: "weeklyPriceCents", priceIdField: "stripeWeeklyPriceId", stripeInterval: "week" },
  MONTHLY: { centsField: "monthlyPriceCents", priceIdField: "stripePriceId", stripeInterval: "month" },
  ANNUAL: { centsField: "annualPriceCents", priceIdField: "stripeAnnualPriceId", stripeInterval: "year" },
};

export function packageCents(h: HandicapperProfile, interval: PackageInterval): number | null {
  return h[PACKAGE_CONFIG[interval].centsField];
}

export function packagePriceId(h: HandicapperProfile, interval: PackageInterval): string | null {
  return h[PACKAGE_CONFIG[interval].priceIdField];
}

/**
 * Make sure a Stripe Price exists for every package the handicapper offers,
 * creating the Product first if needed. Stripe Prices are immutable, so a
 * changed amount is handled upstream by clearing the stored price id — this
 * then creates a fresh Price (existing subscriptions keep billing on the old
 * one, which is exactly Stripe's intended model).
 *
 * Returns the refreshed profile. Throws only if Stripe is unreachable AND
 * something needed to be created — callers treat that as "try again later".
 */
export async function ensureSubscriberPrices(h: HandicapperProfile): Promise<HandicapperProfile> {
  const missing = PACKAGE_INTERVALS.filter(
    (interval) => packageCents(h, interval) != null && !packagePriceId(h, interval)
  );
  if (missing.length === 0) return h;

  const productId =
    h.stripeProductId ??
    (
      await stripe.products.create({
        name: `Blitz.tips — ${h.displayName}`,
        metadata: { handle: h.handle },
      })
    ).id;

  const data: Record<string, string> = { stripeProductId: productId };
  for (const interval of missing) {
    const { centsField, priceIdField, stripeInterval } = PACKAGE_CONFIG[interval];
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: h[centsField]!,
      currency: h.priceCurrency.toLowerCase(),
      recurring: { interval: stripeInterval },
    });
    data[priceIdField] = price.id;
  }

  return prisma.handicapperProfile.update({ where: { id: h.id }, data });
}
