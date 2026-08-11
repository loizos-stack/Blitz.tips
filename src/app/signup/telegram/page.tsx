"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Send } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { fetchJson } from "@/lib/fetch-json";
import { TELEGRAM_SIGNUP_KEY } from "@/components/telegram-login-button";

/**
 * The second half of a Telegram sign-up.
 *
 * Telegram authenticates the person but never gives us an email, and the whole
 * account model needs one — verification, receipts, digests, password reset. So
 * this asks for it, then creates the account against the signed payload the
 * widget produced.
 *
 * Reached only via the widget, which leaves that payload in sessionStorage.
 * Arriving here directly has nothing to work with and says so instead of
 * showing a form that cannot submit.
 */
function TelegramSignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const as = params.get("as") === "handicapper" ? "handicapper" : "subscriber";

  const [payload, setPayload] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Deferred rather than set synchronously in the effect body: sessionStorage
    // is client-only so this can't be seeded during render, and the same
    // deferral is what the other storage-backed components here do.
    const t = setTimeout(() => {
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(TELEGRAM_SIGNUP_KEY);
      } catch {
        stored = null;
      }
      setPayload(stored);
      // Prefill from what Telegram told us, so most people only type an email.
      if (stored) {
        try {
          const data = JSON.parse(stored) as { first_name?: string; last_name?: string; username?: string };
          const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
          if (full) setName(full);
          if (data.username) setUsername(data.username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
        } catch {
          // Prefill is a convenience; the server reads the payload itself.
        }
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payload) return;
    setError(null);
    setLoading(true);

    const created = await fetchJson("/api/telegram-login/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram: JSON.parse(payload), name, username, email, country }),
    });

    if (!created.ok) {
      setError(created.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("telegram", { payload, redirect: false });
    // Spent either way — leaving it would let a stale payload start another
    // signup on a shared browser.
    try {
      sessionStorage.removeItem(TELEGRAM_SIGNUP_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
    setLoading(false);

    if (signInRes?.error) {
      router.push("/signin");
      return;
    }
    router.push(`/onboarding/verify?as=${as}`);
    router.refresh();
  }

  if (!ready) return null;

  if (!payload) {
    return (
      <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="text-xl font-bold">Start from the sign-up page</h1>
          <p className="mt-2 text-sm text-muted">
            This step finishes a Telegram sign-up, and there isn&apos;t one in progress.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground"
          >
            Go to sign-up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent">
          <Send className="h-4 w-4" /> Telegram connected
        </div>
        <h1 className="mt-3 text-xl font-bold">One more thing</h1>
        <p className="mt-1 text-sm text-muted">
          Telegram doesn&apos;t share your email, and we need one for receipts, results and account
          recovery.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="tg-name" className="mb-1 block text-sm font-medium">Name</label>
            <input
              id="tg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={60}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tg-username" className="mb-1 block text-sm font-medium">Username</label>
            <input
              id="tg-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tg-email" className="mb-1 block text-sm font-medium">Email</label>
            <input
              id="tg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="tg-country" className="mb-1 block text-sm font-medium">Country</label>
            <select
              id="tg-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="" disabled>Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            {loading ? "Creating your account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function TelegramSignUpPage() {
  return (
    <Suspense fallback={null}>
      <TelegramSignUpForm />
    </Suspense>
  );
}
