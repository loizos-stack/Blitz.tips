"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

export function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetchJson("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send the link. Please try again.");
      return;
    }
    setSent(true);
  }

  // The confirmation deliberately does not say whether an account was found —
  // matching the endpoint, which cannot say either without turning itself into
  // a way of testing whether a given person has an account here.
  if (sent) {
    return (
      <div className="card w-full max-w-sm p-8 text-center">
        <MailCheck className="mx-auto h-12 w-12 text-accent" />
        <h1 className="mt-4 text-xl font-bold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset
          link is on its way. It expires in an hour.
        </p>
        <p className="mt-4 text-sm text-muted">
          Nothing arrived? Check spam, then{" "}
          <button
            onClick={() => {
              setSent(false);
              setError(null);
            }}
            className="font-medium text-accent hover:underline"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:border-accent"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="text-xl font-bold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">
        Enter the email on your account and we&rsquo;ll send you a link to set a new password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium" htmlFor="reset-email">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/signin" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
