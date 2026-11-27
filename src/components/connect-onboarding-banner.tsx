"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, ExternalLink } from "lucide-react";
import { STRIPE_PAYOUT_COUNTRIES } from "@/lib/countries";

export function ConnectOnboardingBanner({
  resume = false,
  /** Prefills the picker: the started account's country, else the signup country. */
  defaultCountry = "",
  /** Their signup country, when Stripe can't pay out to it. Crypto is the route. */
  unsupportedCountry = null,
}: {
  resume?: boolean;
  defaultCountry?: string;
  unsupportedCountry?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState(defaultCountry);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not start Stripe onboarding");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  return (
    <div className="card flex flex-col gap-4 border-gold/40 bg-gold/5 p-5">
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
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full sm:max-w-xs">
          <span className="text-xs font-medium">Country of your bank account</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Select a country
            </option>
            {STRIPE_PAYOUT_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {/* Said before they click, because Stripe won't let it be said after:
              a connected account's country is fixed for its whole life. */}
          <p className="mt-1 text-xs text-muted">
            Stripe locks this in and it can&apos;t be changed later.
            {resume ? " Choosing a different one starts a fresh account." : ""}
          </p>
        </label>

        <button
          onClick={handleClick}
          disabled={loading || !country}
          className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[#1a1204] hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Redirecting…" : resume ? "Resume setup" : "Set up payouts"}
        </button>
      </div>

      {unsupportedCountry && (
        <p className="text-sm text-muted">
          Stripe can&apos;t pay out to {unsupportedCountry}, so there&apos;s nothing to prefill
          above. If your bank is in one of the countries listed, pick it — otherwise add a crypto
          payout address below and your subscribers can still pay you by card.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
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
