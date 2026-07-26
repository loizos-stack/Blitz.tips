"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";

// Collects onboarding basics for Google signups (credentials signups collect
// these on the registration form instead): a login username and country. Each
// field renders only when still missing for this account.
export function CountryForm({
  initialCountry,
  needsUsername,
  needsCountry,
  nextHref,
}: {
  initialCountry: string;
  needsUsername: boolean;
  needsCountry: boolean;
  nextHref: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/account/country", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(needsUsername ? { username } : {}),
        ...(needsCountry ? { country } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save your details");
      setLoading(false);
      return;
    }
    router.push(nextHref);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {needsUsername && (
        <div>
          <label className="text-sm font-medium">Username</label>
          <input
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            title="3–20 letters, numbers, or underscores"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted">You can sign in with this or your email.</p>
        </div>
      )}

      {needsCountry && (
        <div>
          <label className="text-sm font-medium">Country</label>
          <select
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Select your country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading || (needsCountry && !country) || (needsUsername && !username)}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
