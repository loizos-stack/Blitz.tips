"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Enter the 6-digit code emailed at signup. On success advances to `nextHref`.
export function VerifyCodeForm({ email, nextHref }: { email: string; nextHref: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not verify that code");
      setLoading(false);
      return;
    }
    router.push(nextHref);
    router.refresh();
  }

  async function resend() {
    setError(null);
    setResent(false);
    await fetch("/api/verify-code/resend", { method: "POST" }).catch(() => {});
    setResent(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below to
        confirm your email.
      </p>
      <input
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        className="w-full rounded-lg border border-border bg-surface-raised px-3 py-3 text-center text-2xl font-semibold tracking-[0.4em] tabular-nums outline-none focus:border-accent"
      />

      {error && <p className="text-sm text-danger">{error}</p>}
      {resent && <p className="text-sm text-accent">A new code is on its way.</p>}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Verifying…" : "Verify email"}
      </button>

      <button
        type="button"
        onClick={resend}
        className="text-center text-xs font-medium text-muted hover:text-foreground"
      >
        Didn&apos;t get it? Resend code
      </button>
    </form>
  );
}
