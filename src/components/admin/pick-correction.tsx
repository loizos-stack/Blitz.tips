"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Correct what a pick says.
 *
 * Kept separate from the result dropdown beside it because it is a different
 * kind of act: grading records what happened, this fixes what was written.
 *
 * The display text and the structured fields the auto-settler grades on are
 * edited in one form, and every field is submitted together, so the two cannot
 * drift apart — a pick reading "Moritz Wagner Over 10.5 Points" while
 * `playerName` still says someone else would be graded against the wrong stat
 * line. The server rejects that combination too; this form is what stops an
 * admin running into it.
 */
export function PickCorrection({
  id,
  matchup,
  selection,
  playerName,
  linePoint,
}: {
  id: string;
  matchup: string;
  selection: string;
  playerName: string | null;
  linePoint: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    matchup,
    selection,
    playerName: playerName ?? "",
    linePoint: linePoint === null ? "" : String(linePoint),
  });

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/picks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchup: form.matchup.trim(),
        selection: form.selection.trim(),
        // An empty box means "no structured value", not an empty string: null
        // sends grading back to parsing the selection text.
        playerName: form.playerName.trim() || null,
        linePoint: form.linePoint.trim() === "" ? null : Number(form.linePoint),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not save the correction.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-lg p-5 text-left">
        <h2 className="font-semibold">Correct this pick</h2>
        <p className="mt-1 text-xs text-muted">
          The change is written to the admin log with its before and after. Correcting a pick that
          has already been graded does not re-grade it.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Matchup" value={form.matchup} onChange={(v) => setForm({ ...form, matchup: v })} />
          <Field
            label="Selection"
            hint="What readers see."
            value={form.selection}
            onChange={(v) => setForm({ ...form, selection: v })}
          />
          <Field
            label="Player"
            hint="Graded against this name on player props. Leave empty to grade from the selection text."
            value={form.playerName}
            onChange={(v) => setForm({ ...form, playerName: v })}
          />
          <Field
            label="Line"
            hint="The number the result is compared to."
            value={form.linePoint}
            onChange={(v) => setForm({ ...form, linePoint: v })}
          />
        </div>

        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save correction"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      {hint ? <span className="ml-1.5 text-xs text-muted">{hint}</span> : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
      />
    </label>
  );
}
