"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, X } from "lucide-react";
import { formatCents } from "@/lib/utils";

type Currency = "USD" | "EUR" | "GBP";

export type PendingPayment = {
  id: string;
  reference: string;
  createdAt: string;
  interval: string;
  amountCents: number;
  currency: Currency;
  netCents: number;
  method: string;
  note: string | null;
  subscriberEmail: string;
  handle: string;
};

/**
 * Payments waiting on someone to say the money arrived.
 *
 * Confirming one sells a pass, so the two buttons are deliberately not
 * symmetrical: rejecting asks why, because the reason is sent to the person
 * who thinks they have paid.
 */
export function PendingDirectPayments({ payments }: { payments: PendingPayment[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function decide(id: string, decision: "confirm" | "reject") {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/direct-payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Could not record that.");
      return;
    }
    setRejecting(null);
    setReason("");
    router.refresh();
  }

  if (payments.length === 0) return null;

  return (
    <>
      <h2 className="mb-3 mt-8 font-semibold">
        Transfers to confirm{" "}
        <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-white">
          {payments.length}
        </span>
      </h2>
      <p className="mb-3 text-xs text-muted">
        Somebody says they have sent money. Check it against your account, then confirm — that is
        what starts their pass. Nothing here has access yet.
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="card divide-y divide-border p-0">
        {payments.map((p) => (
          <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">
                <code className="rounded bg-surface px-1.5 py-0.5 text-sm">{p.reference}</code>{" "}
                <span className="font-normal text-muted">
                  {formatCents(p.amountCents, p.currency)} via {p.method}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {p.subscriberEmail} → @{p.handle} · {p.interval.toLowerCase()} pass · owed to them{" "}
                <span className="font-medium text-foreground">
                  {formatCents(p.netCents, p.currency)}
                </span>
              </p>
              {p.note && <p className="mt-1 text-xs text-muted">Their note: {p.note}</p>}
              {rejecting === p.id && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why? This is sent to them."
                  className="mt-2 block w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
                />
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {rejecting === p.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => decide(p.id, "reject")}
                    disabled={busy === p.id}
                    className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busy === p.id ? "Saving…" : "Confirm rejection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(null);
                      setReason("");
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => decide(p.id, "confirm")}
                    disabled={busy === p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {busy === p.id ? "Saving…" : "Money arrived"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-danger"
                  >
                    <X className="h-3.5 w-3.5" /> Didn&apos;t
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Write down a transfer that has gone out to a handicapper. */
export function RecordPayout({
  handicappers,
}: {
  handicappers: { id: string; handle: string; owedCents: number; currency: Currency }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [handicapperId, setHandicapperId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = handicappers.find((h) => h.id === handicapperId);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId, amount: Number(amount), method, reference, paidAt }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save that.");
      return;
    }
    setOpen(false);
    setAmount("");
    setReference("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent"
      >
        <Banknote className="h-3.5 w-3.5" /> Record a payout
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-sm font-semibold">Record a payout</p>
      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="text-xs font-medium">Handicapper</span>
          <select
            value={handicapperId}
            onChange={(e) => {
              setHandicapperId(e.target.value);
              const h = handicappers.find((x) => x.id === e.target.value);
              // Prefilled with what is outstanding, which is what gets sent
              // nearly every time — and still editable for a part payment.
              if (h && h.owedCents > 0) setAmount((h.owedCents / 100).toFixed(2));
            }}
            className="mt-1 block rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          >
            <option value="">Select…</option>
            {handicappers.map((h) => (
              <option key={h.id} value={h.id}>
                @{h.handle}
                {h.owedCents > 0 ? ` — ${formatCents(h.owedCents, h.currency)} owed` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium">
            Amount{chosen ? ` (${chosen.currency})` : ""}
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 block w-28 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium">How</span>
          <input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 block w-40 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium">
            Reference <span className="text-muted">— optional</span>
          </span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transfer id or tx hash"
            className="mt-1 block w-48 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium">Sent on</span>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          />
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !handicapperId || !amount}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Switch direct payment on, and say where the money goes. */
export function DirectPaymentSettings({
  initial,
  suggested,
}: {
  initial: { enabled: boolean; methods: string[]; instructions: string };
  suggested: string[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [methods, setMethods] = useState<string[]>(
    initial.methods.length ? initial.methods : suggested.slice(0, 2)
  );
  const [instructions, setInstructions] = useState(initial.instructions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggleMethod(m: string) {
    setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/payments/direct-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, methods, instructions }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const options = [...new Set([...suggested, ...methods])];

  return (
    <div className="card space-y-3 p-5">
      <div>
        <h2 className="font-semibold">Pay us directly</h2>
        <p className="mt-1 text-sm text-muted">
          A third way to buy a pass, alongside card and crypto: the subscriber sends the money
          straight to you and you confirm it here. There is no processor involved, so it works for
          handicappers in countries Stripe can&apos;t pay — you send them their share yourself.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span className="font-medium">Offer this on handicapper profiles</span>
      </label>

      <div>
        <span className="text-xs font-medium">Methods you accept</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {options.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              className={
                methods.includes(m)
                  ? "rounded-full border border-accent bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent"
                  : "rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
              }
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-medium">Payment details</span>
        <span className="ml-1.5 text-xs text-muted">
          Shown to the customer exactly as typed, so check every digit.
        </span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={5}
          placeholder={"Bank transfer\nIBAN: CY00 0000 0000 0000\nName: …\n\nPayPal\npaypal.me/…"}
          className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-muted"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-accent">Saved.</p>}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
