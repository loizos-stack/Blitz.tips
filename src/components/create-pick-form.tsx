"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";

const sportKeys = Object.keys(SPORT_LABELS);
const betTypeKeys = Object.keys(BET_TYPE_LABELS);

export function CreatePickForm({ handicapperSports }: { handicapperSports: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState(handicapperSports[0] ?? sportKeys[0]);
  const [league, setLeague] = useState("");
  const [matchup, setMatchup] = useState("");
  const [betType, setBetType] = useState(betTypeKeys[0]);
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("-110");
  const [units, setUnits] = useState("1");
  const [analysis, setAnalysis] = useState("");
  const [isPremium, setIsPremium] = useState(true);
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport,
        league: league || undefined,
        matchup,
        betType,
        selection,
        odds: Number(odds),
        units: Number(units),
        analysis: analysis || undefined,
        isPremium,
        eventStartsAt: new Date(eventStartsAt).toISOString(),
      }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not create pick");
      return;
    }

    setMatchup("");
    setSelection("");
    setAnalysis("");
    setEventStartsAt("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        + Post a new pick
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Sport</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {sportKeys.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">League (optional)</label>
          <input
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Matchup</label>
        <input
          required
          value={matchup}
          onChange={(e) => setMatchup(e.target.value)}
          placeholder="Chiefs @ Bills"
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Bet type</label>
          <select
            value={betType}
            onChange={(e) => setBetType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {betTypeKeys.map((b) => (
              <option key={b} value={b}>
                {BET_TYPE_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Selection</label>
          <input
            required
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            placeholder="Bills -2.5"
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Odds</label>
          <input
            required
            type="number"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
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
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Event starts</label>
          <input
            required
            type="datetime-local"
            value={eventStartsAt}
            onChange={(e) => setEventStartsAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Analysis (optional)</label>
        <textarea
          value={analysis}
          onChange={(e) => setAnalysis(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
        Premium pick (locked for non-subscribers)
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Posting…" : "Post pick"}
        </button>
      </div>
    </form>
  );
}
