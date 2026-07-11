"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

// Superadmin tool: comp a customer a subscription to a handicapper (no charge).
export function GrantSubscriptionForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [days, setDays] = useState("");
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/subscriptions/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, handle, days: days ? Number(days) : 0 }),
    });
    const body = await res.json().catch(() => ({}));
    setState("idle");
    if (!res.ok) {
      setError(body.error ?? "Could not grant subscription");
      return;
    }
    setMessage(body.message ?? "Subscription granted");
    setEmail("");
    setHandle("");
    setDays("");
    router.refresh();
  }

  const input =
    "mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <UserPlus className="h-4 w-4 text-accent" /> Grant a subscription
      </p>
      <p className="mt-1 text-sm text-muted">
        Comp a customer access to a handicapper with no payment. Leave days blank for open-ended access.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_7rem_auto] sm:items-end">
        <label className="block">
          <span className="text-xs text-muted">Customer email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" className={input} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Handicapper handle</span>
          <input required value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@sharpsteve" className={input} />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Days</span>
          <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} placeholder="∞" className={input} />
        </label>
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" ? "Granting…" : "Grant"}
        </button>
      </form>
      {message && <p className="mt-3 text-sm font-medium text-accent">{message}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
