"use client";

import { useEffect, useState } from "react";
import { TicketPercent } from "lucide-react";

interface Promo {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  duration: string | null;
  timesRedeemed: number;
}

export function PromoManager() {
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [months, setMonths] = useState("3");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/promos");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not load promo codes");
      setPromos([]);
      return;
    }
    setError(null);
    setPromos(body.promos);
  }

  useEffect(() => {
    // Deferred so the effect itself doesn't set state synchronously.
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, percentOff: Number(percentOff), duration, months: Number(months) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create promo code");
      return;
    }
    setCode("");
    void load();
  }

  async function toggle(promo: Promo) {
    await fetch("/api/admin/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: promo.id, active: !promo.active }),
    });
    void load();
  }

  const input =
    "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div>
      <div className="card max-w-3xl p-5">
        <p className="flex items-center gap-2 font-semibold">
          <TicketPercent className="h-4 w-4 text-accent" /> Create promo code
        </p>
        <p className="mt-1 text-xs text-muted">
          Subscribers can enter codes at checkout (both pick subscriptions and handicapper plans).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <span className="text-xs text-muted">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH20"
              className={`${input} mt-1 block w-36 font-mono uppercase`}
            />
          </div>
          <div>
            <span className="text-xs text-muted">% off</span>
            <input
              type="number"
              min="1"
              max="100"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              className={`${input} mt-1 block w-20`}
            />
          </div>
          <div>
            <span className="text-xs text-muted">Applies</span>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as typeof duration)}
              className={`${input} mt-1 block`}
            >
              <option value="once">First payment only</option>
              <option value="repeating">First N months</option>
              <option value="forever">Every payment</option>
            </select>
          </div>
          {duration === "repeating" && (
            <div>
              <span className="text-xs text-muted">Months</span>
              <input
                type="number"
                min="1"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                className={`${input} mt-1 block w-20`}
              />
            </div>
          )}
          <button
            type="button"
            onClick={create}
            disabled={busy || !code}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="card mt-4 max-w-3xl overflow-x-auto p-0">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Applies</th>
              <th className="px-4 py-3">Redeemed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {promos === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            ) : promos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No promo codes yet.
                </td>
              </tr>
            ) : (
              promos.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 font-mono font-medium">{p.code}</td>
                  <td className="px-4 py-2.5">{p.percentOff != null ? `${p.percentOff}% off` : "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{p.duration ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{p.timesRedeemed}</td>
                  <td className="px-4 py-2.5">
                    {p.active ? (
                      <span className="text-accent">Active</span>
                    ) : (
                      <span className="text-muted">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
                    >
                      {p.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
