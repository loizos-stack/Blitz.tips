"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { formatCents, cn } from "@/lib/utils";
import type { BillingInterval, HandicapperPlan } from "@prisma/client";

const PLAN_ORDER: HandicapperPlan[] = ["FREE", "SILVER", "GOLD"];

export function PlanPicker({
  currentPlan,
  onSelect,
  disabled,
}: {
  currentPlan?: HandicapperPlan;
  onSelect: (plan: HandicapperPlan, interval: BillingInterval) => void;
  disabled?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("MONTHLY");

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface-raised p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setInterval("MONTHLY")}
            className={cn("rounded-full px-3 py-1", interval === "MONTHLY" ? "bg-surface shadow-sm" : "text-muted")}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("ANNUAL")}
            className={cn("rounded-full px-3 py-1", interval === "ANNUAL" ? "bg-surface shadow-sm" : "text-muted")}
          >
            Annual <span className="text-accent">save ~17%</span>
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const def = PLAN_DEFINITIONS[plan];
          const priceCents = interval === "ANNUAL" ? def.annualPriceCents : def.monthlyPriceCents;
          const isCurrent = currentPlan === plan;

          return (
            <div
              key={plan}
              className={cn(
                "card flex flex-col gap-3 p-5",
                plan === "GOLD" && "border-gold/50 bg-gold/5"
              )}
            >
              <div>
                <p className="flex items-center gap-1.5 font-semibold">
                  {def.label}
                  {plan === "GOLD" && <span className="text-gold">★</span>}
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {priceCents ? formatCents(priceCents) : "$0"}
                  <span className="text-sm font-normal text-muted">
                    {priceCents ? `/${interval === "ANNUAL" ? "yr" : "mo"}` : ""}
                  </span>
                </p>
                <p className="text-sm text-muted">{def.commissionPercent}% commission</p>
              </div>

              <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                {def.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-1.5 text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={disabled || isCurrent}
                onClick={() => onSelect(plan, interval)}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                  plan === "GOLD"
                    ? "bg-gold text-[#1a1204] hover:opacity-90"
                    : "bg-accent text-accent-foreground hover:opacity-90"
                )}
              >
                {isCurrent ? "Current plan" : plan === "FREE" ? "Choose Free" : `Choose ${def.label}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
