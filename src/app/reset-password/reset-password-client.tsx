"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

const MIN_LENGTH = 8;

export function ResetPasswordClient({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Checked here as well as by the input's own constraints so the message is
    // ours and matches the server's rule exactly.
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match");
      return;
    }

    setLoading(true);
    const res = await fetchJson("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    setLoading(false);

    if (!res.ok) {
      setError(res.error ?? "Couldn't reset your password. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="card w-full max-w-sm p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
        <h1 className="mt-4 text-xl font-bold">Password changed</h1>
        <p className="mt-2 text-sm text-muted">
          You can now sign in with your new password.
        </p>
        <button
          onClick={() => router.push("/signin")}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-xl font-bold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">At least {MIN_LENGTH} characters.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTH}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/signin" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
