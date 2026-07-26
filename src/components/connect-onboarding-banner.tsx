"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, ExternalLink } from "lucide-react";

export function ConnectOnboardingBanner({ resume = false }: { resume?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/connect", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not start Stripe onboarding");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  return (
    <div className="card flex flex-col items-start gap-3 border-gold/40 bg-gold/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div>
          <p className="font-semibold">
            {resume ? "Finish your Stripe setup" : "Connect Stripe to get paid"}
          </p>
          <p className="text-sm text-muted">
            {resume
              ? "Your Stripe account is started but not finished — complete it so subscribers can pay you."
              : "You need a connected Stripe account before subscribers can pay you. Picks you post are still tracked publicly in the meantime."}
          </p>
          {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[#1a1204] hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Redirecting…" : resume ? "Resume setup" : "Set up payouts"}
      </button>
    </div>
  );
}

/** Shown once the account is ready: confirmation plus a jump to Stripe's Express payouts dashboard. */
export function StripePayoutsCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/connect/login", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't open the payouts dashboard");
      return;
    }
    if (body.url) window.open(body.url, "_blank", "noopener");
  }

  return (
    <div className="card flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <CircleCheck className="h-5 w-5 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-semibold">Stripe connected — subscribers can pay you</p>
          {error && <p className="mt-0.5 text-sm text-danger">{error}</p>}
        </div>
      </div>
      <button
        onClick={open}
        disabled={loading}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground disabled:opacity-60"
      >
        {loading ? "Opening…" : "View payouts"} <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
