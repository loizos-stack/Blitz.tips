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
      "Gold verified badge next to your name",
      "Top placement on the homepage and leaderboard",
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

/**
 * Tailwind text-color class for the plan badge next to a handicapper's name —
 * gold for an active Gold plan, silver for an active Silver plan. Returns null
 * for Free (or a paid plan that isn't currently active): those handicappers
 * show no badge at all.
 */
export function verifiedBadgeColorClass(
  plan: HandicapperPlan,
  planStatus: SubscriptionStatus
): string | null {
  if (planStatus !== "ACTIVE") return null;
  if (plan === "GOLD") return "text-gold";
  if (plan === "SILVER") return "text-silver";
  return null;
}

/**
 * The plan a verified badge should represent, or null when none should show
 * (Free plan, or a paid plan that isn't currently active). Drives the filled
 * PlanBadge next to a handicapper's name.
 */
export function verifiedBadgePlan(
  plan: HandicapperPlan,
  planStatus: SubscriptionStatus
): "GOLD" | "SILVER" | null {
  if (planStatus !== "ACTIVE") return null;
  if (plan === "GOLD") return "GOLD";
  if (plan === "SILVER") return "SILVER";
  return null;
}
