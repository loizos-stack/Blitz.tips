"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SPORT_LABELS } from "@/lib/utils";
import { SportIcon } from "@/components/sport-icon";
import { PlanPicker } from "@/components/plan-picker";
import type { BillingInterval, HandicapperPlan, PickSport } from "@prisma/client";

export function BecomeHandicapperForm() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "plan">("details");

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [price, setPrice] = useState("29.99");
  const [weeklyPrice, setWeeklyPrice] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSport(sport: string) {
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("plan");
  }

  async function handlePlanSelect(plan: HandicapperPlan, interval: BillingInterval) {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/handicapper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        displayName,
        bio,
        sports,
        monthlyPriceCents: Math.round(parseFloat(price || "0") * 100),
        weeklyPriceCents: weeklyPrice ? Math.round(parseFloat(weeklyPrice) * 100) : null,
        annualPriceCents: annualPrice ? Math.round(parseFloat(annualPrice) * 100) : null,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(body.error ?? "Something went wrong");
      setStep("details");
      return;
    }

    if (plan === "FREE") {
      setLoading(false);
      router.refresh();
      return;
    }

    const checkoutRes = await fetch("/api/handicapper/plan/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, interval }),
    });
    const checkoutBody = await checkoutRes.json().catch(() => ({}));
    setLoading(false);

    if (!checkoutRes.ok) {
      setError(checkoutBody.error ?? "Profile created, but plan checkout failed — you can upgrade later from your dashboard.");
      router.refresh();
      return;
    }

    if (checkoutBody.url) window.location.href = checkoutBody.url;
  }

  if (step === "plan") {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h1 className="text-xl font-bold">Choose your plan</h1>
          <p className="mt-1 text-sm text-muted">You can change this anytime from your dashboard.</p>
        </div>
        <div className="mt-6">
          <PlanPicker onSelect={handlePlanSelect} disabled={loading} trialEligible />
        </div>
        {error && <p className="mt-4 text-center text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => setStep("details")}
          className="mx-auto mt-6 block text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to profile details
        </button>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-lg p-8">
      <h1 className="text-xl font-bold">Become a handicapper</h1>
      <p className="mt-1 text-sm text-muted">
        Set up your public profile. Every pick you post from here on builds your permanent track record.
      </p>

      <form onSubmit={handleDetailsSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium">Handle</label>
          <div className="mt-1 flex items-center rounded-lg border border-border bg-surface-raised px-3 focus-within:border-accent">
            <span className="text-sm text-muted">@</span>
            <input
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              pattern="[a-z0-9_]+"
              className="w-full bg-transparent py-2 pl-1 text-sm outline-none"
              placeholder="sharpsteve"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Sports you cover</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(SPORT_LABELS).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => toggleSport(value)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  sports.includes(value)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                <SportIcon sport={value as PickSport} className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Subscription packages (USD)</label>
          <p className="mt-0.5 text-xs text-muted">
            Monthly is required; add weekly and annual packages if you want to offer them.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <span className="text-xs text-muted">Weekly (optional)</span>
              <input
                type="number"
                min="1.99"
                step="0.01"
                placeholder="—"
                value={weeklyPrice}
                onChange={(e) => setWeeklyPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <span className="text-xs text-muted">Monthly</span>
              <input
                required
                type="number"
                min="4.99"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <span className="text-xs text-muted">Annual (optional)</span>
              <input
                type="number"
                min="9.99"
                step="0.01"
                placeholder="—"
                value={annualPrice}
                onChange={(e) => setAnnualPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={sports.length === 0}
          className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue to plan selection
        </button>
      </form>
    </div>
  );
}
