"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { TrendingUp, Megaphone } from "lucide-react";
import { GoogleIcon } from "@/components/google-icon";

function RoleChooser() {
  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Join Blitz.tips</h1>
          <p className="mt-2 text-muted">How are you looking to use the site?</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/signup?as=subscriber"
            className="card flex flex-col items-start gap-3 p-6 transition-colors hover:border-accent/60"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">I want to follow picks</p>
              <p className="mt-1 text-sm text-muted">
                Browse the leaderboard and subscribe to handicappers with a verified track record.
              </p>
            </div>
          </Link>

          <Link
            href="/signup?as=handicapper"
            className="card flex flex-col items-start gap-3 p-6 transition-colors hover:border-accent/60"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/15 text-gold">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">I want to post picks</p>
              <p className="mt-1 text-sm text-muted">
                Build a public track record and get paid by subscribers. Free to start.
              </p>
            </div>
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function SignUpForm({ as }: { as: "subscriber" | "handicapper" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const destination = as === "handicapper" ? "/dashboard/handicapper" : "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInRes?.error) {
      router.push("/signin");
      return;
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="card w-full max-w-sm p-8">
        <Link href="/signup" className="text-xs font-medium text-muted hover:text-foreground">
          ← Choose a different path
        </Link>
        <h1 className="mt-3 text-xl font-bold">
          {as === "handicapper" ? "Become a handicapper" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {as === "handicapper"
            ? "Set up your account, then build your public profile."
            : "Start following winning handicappers."}
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: destination })}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-white py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          <GoogleIcon className="h-4 w-4" />
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              required
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
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function SignUpRouter() {
  const searchParams = useSearchParams();
  const as = searchParams.get("as");

  if (as === "subscriber" || as === "handicapper") {
    return <SignUpForm as={as} />;
  }
  return <RoleChooser />;
}

export default function SignUpPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/auth-bg.svg')] bg-cover bg-center"
      />
      <div className="relative">
        <Suspense fallback={null}>
          <SignUpRouter />
        </Suspense>
      </div>
    </div>
  );
}
