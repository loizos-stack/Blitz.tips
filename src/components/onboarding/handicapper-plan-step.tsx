"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlanPicker } from "@/components/plan-picker";
import type { BillingInterval, HandicapperPlan } from "@prisma/client";

// Final wizard step: pick the platform plan. Free lands on the dashboard; paid
// plans go through Stripe checkout and return to the dashboard after payment.
export function HandicapperPlanStep({ currentPlan }: { currentPlan: HandicapperPlan }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function select(plan: HandicapperPlan, interval: BillingInterval) {
    setError(null);
    if (plan === "FREE") {
      router.push("/dashboard/handicapper");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/handicapper/plan/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't start plan checkout — you can upgrade later from your dashboard.");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  return (
    <div>
      <PlanPicker currentPlan={currentPlan} onSelect={select} disabled={loading} />
      {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
      <p className="mt-6 text-center">
        <Link href="/dashboard/handicapper" className="text-sm text-muted hover:text-foreground">
          Skip — start on Free
        </Link>
      </p>
    </div>
  );
}
