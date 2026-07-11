import type { BillingInterval, HandicapperPlan, SubscriptionStatus } from "@prisma/client";

export interface PlanDefinition {
  plan: HandicapperPlan;
  label: string;
  commissionPercent: number;
  monthlyPriceCents: number | null;
  annualPriceCents: number | null;
  perks: string[];
}

export const PLAN_DEFINITIONS: Record<HandicapperPlan, PlanDefinition> = {
  FREE: {
    plan: "FREE",
    label: "Free",
    commissionPercent: 20,
    monthlyPriceCents: null,
    annualPriceCents: null,
    perks: ["Post picks and build your public record", "80% of every subscription, no monthly cost"],
  },
  SILVER: {
    plan: "SILVER",
    label: "Silver",
    commissionPercent: 15,
    monthlyPriceCents: 999,
    annualPriceCents: 9999,
    perks: ["Everything in Free", "Lower 15% commission — keep 85%"],
  },
  GOLD: {
    plan: "GOLD",
    label: "Gold",
    commissionPercent: 10,
    monthlyPriceCents: 4999,
    annualPriceCents: 49999,
    perks: [
      "Everything in Silver",
      "Lowest 10% commission — keep 90%",
      "Featured at the top of the homepage and leaderboard",
      "Promoted on Blitz.tips social media",
    ],
  },
};

export function commissionPercentForPlan(plan: HandicapperPlan): number {
  return PLAN_DEFINITIONS[plan].commissionPercent;
}

export function planPriceCents(plan: HandicapperPlan, interval: BillingInterval): number | null {
  return interval === "ANNUAL" ? PLAN_DEFINITIONS[plan].annualPriceCents : PLAN_DEFINITIONS[plan].monthlyPriceCents;
}

/** Gold's homepage/leaderboard featuring only applies while their plan billing is actually current. */
export function isFeaturedHandicapper(plan: HandicapperPlan, planStatus: SubscriptionStatus): boolean {
  return plan === "GOLD" && planStatus === "ACTIVE";
}

/**
 * Tailwind text-color class for the verified badge, tinted by the handicapper's
 * active plan: gold for Gold, silver for Silver, default accent otherwise
 * (Free, or a paid plan that isn't currently active).
 */
export function verifiedBadgeColorClass(plan: HandicapperPlan, planStatus: SubscriptionStatus): string {
  if (planStatus === "ACTIVE" && plan === "GOLD") return "text-gold";
  if (planStatus === "ACTIVE" && plan === "SILVER") return "text-silver";
  return "text-accent";
}
