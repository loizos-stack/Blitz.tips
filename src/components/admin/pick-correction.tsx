"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatOdds, unitProfit } from "@/lib/odds";
import type { PickResult } from "@prisma/client";

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
  odds,
  units,
  result,
}: {
  id: string;
  matchup: string;
  selection: string;
  playerName: string | null;
  linePoint: number | null;
  odds: number;
  /** Not editable — the stake is what the capper risked. Here to price the win. */
  units: number;
  result: PickResult;
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
    odds: String(odds),
  });

  // What the pick is worth at the price in the box, recomputed as it is typed.
  // Units won is derived from odds on every read, so this is the figure the
  // leaderboard will show the moment this is saved — not a projection.
  const typedOdds = Number(form.odds);
  const oddsValid = form.odds.trim() !== "" && Number.isInteger(typedOdds) && Math.abs(typedOdds) >= 100;
  const wasWorth = unitProfit(odds, units, result);
  const nowWorth = oddsValid ? unitProfit(typedOdds, units, result) : null;
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}u`;

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
        odds: Number(form.odds),
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
    // Above the site pop-ups, which sit at z-[80]. At z-50 the Supercapper
    // promo mounted over this dialog and swallowed the click on Save — the
    // admin could see the form and not submit it.
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
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
          <Field
            label="Odds"
            hint="American, e.g. -110 or +150. Correcting this re-prices the pick."
            value={form.odds}
            onChange={(v) => setForm({ ...form, odds: v })}
          />

          {/* The consequence of the price, stated before it is saved. A graded
              pick is the case that matters: changing the odds on it moves the
              handicapper's record, and that should not be a surprise. */}
          {result === "PENDING" ? (
            <p className="text-xs text-muted">
              Still pending, so no units have been won or lost yet. At{" "}
              {oddsValid ? formatOdds(typedOdds) : "—"} a {units}u win would return{" "}
              {nowWorth === null ? "—" : signed(unitProfit(typedOdds, units, "WIN"))}.
            </p>
          ) : nowWorth !== null && nowWorth !== wasWorth ? (
            <p className="text-xs">
              <span className="text-muted">Units won on this {result.toLowerCase()}: </span>
              <span className="font-medium">{signed(wasWorth)}</span>
              <span className="text-muted"> → </span>
              <span className="font-semibold text-accent">{signed(nowWorth)}</span>
              <span className="text-muted">, applied as soon as you save.</span>
            </p>
          ) : (
            <p className="text-xs text-muted">
              Units won on this {result.toLowerCase()}: {signed(wasWorth)}.
            </p>
          )}
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
        // `block`, not just `w-full`: an input is inline-block by default, so
        // at width:100% it was laid out after the label text and ran past the
        // right edge of the dialog — each field by a different amount, since
        // each label is a different length.
        className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
      />
    </label>
  );
}
