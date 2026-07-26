"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SPORT_LABELS } from "@/lib/utils";
import { SportIcon } from "@/components/sport-icon";
import type { PickSport } from "@prisma/client";

// Identity step of the handicapper wizard: creates the profile, then advances
// to pricing. Prices are set on the next step, so this seeds a default monthly.
export function HandicapperProfileForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSport(sport: string) {
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sports.length === 0) {
      setError("Pick at least one sport");
      return;
    }
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
        // A default monthly price; refined on the next (pricing) step.
        monthlyPriceCents: 2999,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }
    router.push("/onboarding/handicapper/pricing");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium">Handle</label>
        <div className="mt-1 flex items-center rounded-lg border border-border bg-surface-raised px-3 focus-within:border-accent">
          <span className="text-sm text-muted">@</span>
          <input
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            pattern="[a-z0-9_]+"
            placeholder="sharpsteve"
            className="w-full bg-transparent py-2 pl-1 text-sm outline-none"
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

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading || sports.length === 0}
        className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating profile…" : "Continue"}
      </button>
    </form>
  );
}
