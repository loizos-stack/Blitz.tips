import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { resetTokenState } from "@/lib/password-reset";
import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: true },
};

// The token arrives in the query string, so there is nothing to cache and a
// stale render would show a dead link as live.
export const dynamic = "force-dynamic";

/**
 * Set a new password from an emailed link.
 *
 * The token is checked BEFORE the form is shown, rather than only on submit.
 * A link that has expired or been used is the common case here — people find
 * the mail the next morning — and letting someone choose a password, type it
 * twice, and only then be told the link was dead is the wrong order to learn it.
 * Checking is a read; the token is spent only by the submit.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const state = await resetTokenState(token ?? "");

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      {state === "valid" ? (
        <ResetPasswordClient token={token ?? ""} />
      ) : (
        <div className="card w-full max-w-sm p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-danger" />
          <h1 className="mt-4 text-xl font-bold">
            {state === "expired" ? "That link has expired" : "That link doesn't work"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {state === "expired"
              ? "Reset links last an hour. Ask for a new one and it'll arrive in a moment."
              : "This reset link is invalid or has already been used. Ask for a new one to continue."}
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Send a new link
          </Link>
          <Link
            href="/signin"
            className="mt-3 inline-block w-full rounded-lg border border-border py-2.5 text-sm font-semibold hover:border-accent"
          >
            Back to sign in
          </Link>
        </div>
      )}
    </div>
  );
}
