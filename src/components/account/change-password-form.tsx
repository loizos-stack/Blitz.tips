"use client";

import { useState } from "react";

// Change (or set, for Google-only accounts) your password. Shown to every user.
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next !== confirm) {
      setError("New passwords don't match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update your password");
      return;
    }
    setSaved(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-semibold">{hasPassword ? "Change password" : "Set a password"}</h2>
        <p className="mt-1 text-sm text-muted">
          {hasPassword
            ? "Enter your current password and choose a new one."
            : "You signed up with Google — set a password to also sign in with your email or username."}
        </p>
      </div>

      {hasPassword && (
        <div>
          <label className="text-sm font-medium">Current password</label>
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      )}
      <div>
        <label className="text-sm font-medium">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Confirm new password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-accent">Password updated.</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Saving…" : hasPassword ? "Update password" : "Set password"}
      </button>
    </form>
  );
}
