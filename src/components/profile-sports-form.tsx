"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { SportIcon } from "@/components/sport-icon";
import type { PickSport } from "@prisma/client";

// Editor for the sports a handicapper covers. These drive where they show up in
// search and the rankings; posting a tip in a new sport also adds it here
// automatically, so this is just the manual override.
export function ProfileSportsForm({ initialSports }: { initialSports: string[] }) {
  const router = useRouter();
  const [sports, setSports] = useState<string[]>(initialSports);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    sports.length !== initialSports.length || sports.some((s) => !initialSports.includes(s));

  function toggle(sport: string) {
    setSaved(false);
    setSports((prev) => (prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]));
  }

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/handicapper", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sports }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save your sports");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <p className="text-sm font-semibold">Sports you cover</p>
      <p className="mt-1 text-xs text-muted">
        These control where you appear in search and the leaderboard. Posting a tip in a new sport
        adds it here automatically.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(SPORT_LABELS).map(([value, label]) => {
          const active = sports.includes(value);
          return (
            <button
              type="button"
              key={value}
              onClick={() => toggle(value)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              <SportIcon sport={value as PickSport} className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={save}
        disabled={saving || sports.length === 0 || !dirty}
        className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : saved && !dirty ? "Saved" : "Save sports"}
      </button>
    </div>
  );
}
