"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { formatCents, cn } from "@/lib/utils";
import type { BillingInterval, HandicapperPlan } from "@prisma/client";

const PLAN_ORDER: HandicapperPlan[] = ["FREE", "SILVER", "GOLD"];

// Metallic button treatments so Silver reads as silver and Gold as gold,
// rather than both using the default green accent.
const PLAN_BUTTON_STYLES: Record<HandicapperPlan, string> = {
  FREE: "bg-accent text-accent-foreground hover:opacity-90",
  SILVER:
    "bg-gradient-to-b from-slate-100 to-slate-400 text-slate-900 ring-1 ring-inset ring-slate-300/70 shadow-sm hover:brightness-[1.03]",
  GOLD: "bg-gradient-to-b from-amber-300 to-amber-500 text-[#3a2600] ring-1 ring-inset ring-amber-400/70 shadow-sm hover:brightness-[1.03]",
};

export function PlanPicker({
  currentPlan,
  onSelect,
  onSelectCrypto,
  disabled,
  trialEligible = false,
  cryptoEnabled = false,
}: {
  currentPlan?: HandicapperPlan;
  onSelect: (plan: HandicapperPlan, interval: BillingInterval) => void;
  /** When provided, paid plans show a "Pay with crypto" option. */
  onSelectCrypto?: (plan: HandicapperPlan, interval: BillingInterval) => void;
  disabled?: boolean;
  /** Show the one-time 1-month free trial on Silver/Gold. */
  trialEligible?: boolean;
  cryptoEnabled?: boolean;
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

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const def = PLAN_DEFINITIONS[plan];
          const priceCents = interval === "ANNUAL" ? def.annualPriceCents : def.monthlyPriceCents;
          const isCurrent = currentPlan === plan;
          const isPaid = plan !== "FREE";
          const showTrial = isPaid && trialEligible && !isCurrent;

          return (
            <div
              key={plan}
              className={cn(
                "card flex flex-col gap-5 p-7",
                plan === "GOLD" && "border-gold/50 bg-gold/5"
              )}
            >
              <div>
                <p className="flex items-center gap-1.5 text-lg font-semibold">
                  {def.label}
                  {plan === "GOLD" && <span className="text-gold">★</span>}
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {priceCents ? formatCents(priceCents) : "$0"}
                  <span className="text-base font-normal text-muted">
                    {priceCents ? `/${interval === "ANNUAL" ? "yr" : "mo"}` : ""}
                  </span>
                </p>
                <p className="text-sm text-muted">{def.commissionPercent}% commission</p>
                {showTrial && (
                  <p className="mt-1 text-sm font-semibold text-accent">1-month free trial</p>
                )}
              </div>

              <ul className="flex flex-1 flex-col gap-2.5 text-[15px] leading-snug text-foreground">
                {def.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={disabled || isCurrent}
                onClick={() => onSelect(plan, interval)}
                className={cn(
                  "rounded-lg py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                  PLAN_BUTTON_STYLES[plan]
                )}
              >
                {isCurrent
                  ? "Current plan"
                  : plan === "FREE"
                    ? "Choose Free"
                    : showTrial
                      ? "Start free trial"
                      : `Choose ${def.label}`}
              </button>
              {isPaid && !isCurrent && cryptoEnabled && onSelectCrypto && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectCrypto(plan, interval)}
                  className="-mt-2 rounded-lg border border-border py-2 text-sm font-medium text-muted hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  Pay with crypto
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
