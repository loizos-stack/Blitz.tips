"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanPicker } from "@/components/plan-picker";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import type { BillingInterval, HandicapperPlan, SubscriptionStatus } from "@prisma/client";

export function ManagePlanCard({
  plan,
  planStatus,
  planInterval,
  planCurrentPeriodEnd,
}: {
  plan: HandicapperPlan;
  planStatus: SubscriptionStatus;
  planInterval: BillingInterval | null;
  planCurrentPeriodEnd: Date | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSelect(newPlan: HandicapperPlan, interval: BillingInterval) {
    setError(null);
    setLoading(true);

    if (newPlan === "FREE") {
      const res = await fetch("/api/handicapper/plan/free", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(body.error ?? "Could not switch to Free");
        return;
      }
      router.refresh();
      setOpen(false);
      return;
    }

    const res = await fetch("/api/handicapper/plan/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlan, interval }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not start checkout");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  const def = PLAN_DEFINITIONS[plan];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold">
            {def.label} plan
            {plan === "GOLD" && <span className="text-gold">★</span>}
          </p>
          <p className="text-sm text-muted">
            {def.commissionPercent}% commission
            {planInterval && ` · billed ${planInterval === "ANNUAL" ? "annually" : "monthly"}`}
            {planStatus === "PAST_DUE" && <span className="text-danger"> · payment past due</span>}
            {planCurrentPeriodEnd &&
              ` · renews ${planCurrentPeriodEnd.toLocaleDateString()}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
        >
          {open ? "Close" : "Change plan"}
        </button>
      </div>

      {open && (
        <div className="mt-5 border-t border-border pt-5">
          <PlanPicker currentPlan={plan} onSelect={handleSelect} disabled={loading} />
          {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
