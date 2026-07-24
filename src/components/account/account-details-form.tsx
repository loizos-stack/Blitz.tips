"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { COUNTRIES } from "@/lib/countries";

// Edit your own account details. Username is shown read-only — it can't be
// changed once chosen.
export function AccountDetailsForm({
  username,
  initialName,
  initialEmail,
  initialCountry,
}: {
  username: string | null;
  initialName: string;
  initialEmail: string;
  initialCountry: string;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [country, setCountry] = useState(initialCountry);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setEmailChanged(false);
    setLoading(true);
    const res = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, country }),
    });
    setLoading(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not save your details");
      return;
    }
    setSaved(true);
    setEmailChanged(Boolean(body.emailChanged));
    // Refresh the session so the email/name in the token stay current.
    await update();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
      <div>
        <label className="text-sm font-medium">Username</label>
        <input
          value={username ?? "—"}
          disabled
          className="mt-1 w-full cursor-not-allowed rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted"
        />
        <p className="mt-1 text-xs text-muted">Your username can&apos;t be changed.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Name</label>
        <input
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Country</label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Not set</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && !emailChanged && <p className="text-sm text-accent">Saved.</p>}
      {emailChanged && (
        <p className="text-sm text-accent">
          Saved. We sent a verification link to your new email — please verify it to keep posting and
          subscribing.
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
