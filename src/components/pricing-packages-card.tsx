"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";

function toInput(cents: number | null): string {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function toCents(value: string): number | null {
  if (!value.trim()) return null;
  return Math.round(parseFloat(value) * 100);
}

export function PricingPackagesCard({
  weeklyPriceCents,
  monthlyPriceCents,
  annualPriceCents,
}: {
  weeklyPriceCents: number | null;
  monthlyPriceCents: number;
  annualPriceCents: number | null;
}) {
  const router = useRouter();
  const [weekly, setWeekly] = useState(toInput(weeklyPriceCents));
  const [monthly, setMonthly] = useState(toInput(monthlyPriceCents));
  const [annual, setAnnual] = useState(toInput(annualPriceCents));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);

    const res = await fetch("/api/handicapper/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthlyPriceCents: toCents(monthly) ?? 0,
        weeklyPriceCents: toCents(weekly),
        annualPriceCents: toCents(annual),
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Could not save pricing");
      setState("error");
      return;
    }
    setState("saved");
    router.refresh();
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { min: string; required?: boolean }
  ) => (
    <div>
      <span className="text-xs text-muted">{label}</span>
      <input
        type="number"
        min={opts.min}
        step="0.01"
        required={opts.required}
        placeholder={opts.required ? undefined : "—"}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setState("idle");
        }}
        className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <Tag className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pricing packages</p>
          <p className="text-sm text-muted">
            What subscribers pay for your premium picks. Monthly is required; leave weekly or annual
            blank to not offer them. Price changes apply to new subscribers only.
          </p>

          <div className="mt-3 grid max-w-md grid-cols-3 gap-2">
            {field("Weekly (USD)", weekly, setWeekly, { min: "1.99" })}
            {field("Monthly (USD)", monthly, setMonthly, { min: "4.99", required: true })}
            {field("Annual (USD)", annual, setAnnual, { min: "9.99" })}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={state === "saving" || !monthly}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {state === "saving" ? "Saving…" : "Save pricing"}
            </button>
            {state === "saved" && <span className="text-sm font-medium text-accent">Saved ✓</span>}
            {error && <span className="text-sm text-danger">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
