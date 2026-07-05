"use client";

import { useEffect, useState } from "react";
import { Gauge, Megaphone, CheckCheck } from "lucide-react";

export function OddsQuotaCard() {
  const [data, setData] = useState<{ remaining?: string | null; used?: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/odds-quota");
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Check failed");
      return;
    }
    setData(body);
  }

  useEffect(() => {
    // Deferred so the effect itself doesn't set state synchronously.
    const t = setTimeout(() => void check(), 0);
    return () => clearTimeout(t);
  }, []);

  const remaining = data?.remaining != null ? Number(data.remaining) : null;

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Gauge className="h-4 w-4 text-accent" /> Odds API credits
      </p>
      <div className="mt-3 flex items-end gap-6">
        <div>
          <p className={`text-3xl font-bold tabular-nums ${remaining !== null && remaining < 50 ? "text-danger" : ""}`}>
            {data?.remaining ?? "—"}
          </p>
          <p className="text-xs text-muted">remaining this period</p>
        </div>
        <div>
          <p className="text-3xl font-bold tabular-nums">{data?.used ?? "—"}</p>
          <p className="text-xs text-muted">used</p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={check}
        disabled={busy}
        className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
      >
        {busy ? "Checking…" : "Refresh"}
      </button>
    </div>
  );
}

export function AnnouncementCard({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setState("saving");
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "announcement", value }),
    });
    setState(res.ok ? "saved" : "error");
  }

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Megaphone className="h-4 w-4 text-accent" /> Site announcement
      </p>
      <p className="mt-1 text-xs text-muted">
        Shown as a banner at the top of every page. Leave empty to hide it.
      </p>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        rows={2}
        placeholder="e.g. 🎉 Launch week: 20% off every subscription with code LAUNCH20"
        className="mt-3 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        {state === "saved" && <span className="text-sm font-medium text-accent">Saved ✓</span>}
        {state === "error" && <span className="text-sm text-danger">Save failed</span>}
      </div>
    </div>
  );
}

export function AutoSettleCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/cron/auto-settle");
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setResult(body.error ?? "Run failed");
      return;
    }
    setResult(
      `${body.settled} settled, ${body.skipped} skipped of ${body.candidates} candidates` +
        (body.errors?.length ? ` — ${body.errors.join("; ")}` : "")
    );
  }

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <CheckCheck className="h-4 w-4 text-accent" /> Auto-settle picks
      </p>
      <p className="mt-1 text-xs text-muted">
        Grades pending schedule-created picks from final scores. Runs automatically every morning;
        run it now for games that just finished.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Running…" : "Run now"}
        </button>
        {result && <span className="text-sm text-muted">{result}</span>}
      </div>
    </div>
  );
}
