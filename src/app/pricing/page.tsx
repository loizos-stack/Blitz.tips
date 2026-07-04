import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { formatCents, cn } from "@/lib/utils";
import type { HandicapperPlan } from "@prisma/client";

export const metadata: Metadata = { title: "Become a Handicapper" };

const PLAN_ORDER: HandicapperPlan[] = ["FREE", "SILVER", "GOLD"];

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/auth-bg.svg')] bg-cover bg-center"
      />
      <div className="container-page relative py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold">Turn your picks into income</h1>
        <p className="mt-4 text-muted">
          Blitz.tips handles subscriptions, billing, and record-keeping so you can focus on finding
          winners. Pick a plan — the lower your commission, the more you keep on every subscription.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {PLAN_ORDER.map((plan) => {
          const def = PLAN_DEFINITIONS[plan];
          return (
            <div
              key={plan}
              className={cn("card flex flex-col p-8", plan === "GOLD" && "border-gold/50 bg-gold/5")}
            >
              <div>
                <p className="flex items-center gap-1.5 text-lg font-semibold">
                  {def.label}
                  {plan === "GOLD" && <span className="text-gold">★</span>}
                </p>
                <p className="mt-3 text-3xl font-bold">
                  {def.monthlyPriceCents ? formatCents(def.monthlyPriceCents) : "$0"}
                  <span className="text-sm font-normal text-muted">{def.monthlyPriceCents ? "/mo" : ""}</span>
                </p>
                {def.annualPriceCents && (
                  <p className="mt-1 text-xs text-muted">or {formatCents(def.annualPriceCents)}/yr</p>
                )}
                <p className="mt-4 text-sm font-medium text-accent">{def.commissionPercent}% commission</p>
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-3 text-[15px] leading-snug text-foreground">
                {def.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {perk}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup?as=handicapper"
                className={cn(
                  "mt-8 block rounded-lg py-3 text-center text-sm font-semibold hover:opacity-90",
                  plan === "GOLD" ? "bg-gold text-[#1a1204]" : "bg-accent text-accent-foreground"
                )}
              >
                Get started
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
        No setup fees, no monthly minimums on Free. You can change plans any time from your dashboard.
      </p>
      </div>
    </div>
  );
}
