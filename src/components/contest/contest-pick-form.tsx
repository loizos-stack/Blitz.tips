"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { SPORT_LABELS } from "@/lib/utils";

const sportKeys = Object.keys(SPORT_LABELS);
const input =
  "mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

// Manual pick entry for a contest entrant. Kept deliberately simple: sport,
// matchup, selection, odds, units, and the event start (must be in the future).
export function ContestPickForm({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [sport, setSport] = useState("");
  const [matchup, setMatchup] = useState("");
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("-110");
  const [units, setUnits] = useState("1");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/supercapper/${contestId}/picks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport,
        matchup,
        selection,
        odds: Number(odds),
        units: Number(units),
        eventStartsAt: eventStartsAt ? new Date(eventStartsAt).toISOString() : "",
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not submit pick");
      return;
    }
    setMatchup("");
    setSelection("");
    setOdds("-110");
    setUnits("1");
    setEventStartsAt("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Sport</label>
          <select value={sport} onChange={(e) => setSport(e.target.value)} required className={input}>
            <option value="">Select…</option>
            {sportKeys.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Event starts</label>
          <input
            type="datetime-local"
            required
            value={eventStartsAt}
            onChange={(e) => setEventStartsAt(e.target.value)}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Matchup</label>
        <input
          required
          value={matchup}
          onChange={(e) => setMatchup(e.target.value)}
          placeholder="e.g. Chiefs @ Bills"
          className={input}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Selection</label>
        <input
          required
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          placeholder="e.g. Bills -2.5, Over 44.5"
          className={input}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Odds (American)</label>
          <input required type="number" value={odds} onChange={(e) => setOdds(e.target.value)} className={input} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Units</label>
          <input
            required
            type="number"
            step="0.1"
            min="0.1"
            max="20"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className={input}
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> {loading ? "Submitting…" : "Submit pick"}
      </button>
    </form>
  );
}
