"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SPORT_LABELS } from "@/lib/utils";

export function BecomeHandicapperForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [price, setPrice] = useState("29.99");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSport(sport: string) {
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    router.refresh();
  }

  return (
    <div className="card mx-auto max-w-lg p-8">
      <h1 className="text-xl font-bold">Become a handicapper</h1>
      <p className="mt-1 text-sm text-muted">
        Set up your public profile. Every pick you post from here on builds your permanent track record.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  sports.includes(value)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Monthly subscription price (USD)</label>
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

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Creating profile…" : "Create my profile"}
        </button>
      </form>
    </div>
  );
}
