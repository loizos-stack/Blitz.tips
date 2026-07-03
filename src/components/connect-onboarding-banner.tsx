"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function ConnectOnboardingBanner() {
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
          <p className="font-semibold">Connect Stripe to get paid</p>
          <p className="text-sm text-muted">
            You need a connected Stripe account before subscribers can pay you. Picks you post are still tracked publicly in the meantime.
          </p>
          {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[#1a1204] hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Set up payouts"}
      </button>
    </div>
  );
}
