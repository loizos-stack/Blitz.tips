import { Check } from "lucide-react";
import { verifiedBadgePlan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { HandicapperPlan, SubscriptionStatus } from "@prisma/client";

// Filled, colored verified badge shown next to a handicapper's name when they're
// on an active Silver or Gold plan — gold or silver circle with a white check.
// Renders nothing for Free / inactive plans.
export function PlanBadge({
  plan,
  planStatus,
  size = "sm",
}: {
  plan: HandicapperPlan;
  planStatus: SubscriptionStatus;
  size?: "sm" | "md";
}) {
  const badge = verifiedBadgePlan(plan, planStatus);
  if (!badge) return null;

  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const check = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      title={`${badge === "GOLD" ? "Gold" : "Silver"} plan`}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white",
        box,
        badge === "GOLD" ? "bg-gold" : "bg-silver"
      )}
    >
      <Check className={check} strokeWidth={3} />
    </span>
  );
}
