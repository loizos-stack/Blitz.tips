import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { consumeVerificationToken } from "@/lib/verification";

export const metadata: Metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await consumeVerificationToken(token ?? "");

  const ok = result === "verified" || result === "already";
  const message = {
    verified: "Your email is verified. You're all set!",
    already: "This email was already verified. You're all set!",
    expired: "That verification link has expired. Sign in and resend a new one from your dashboard.",
    invalid: "That verification link is invalid or has already been used.",
  }[result];

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="card w-full max-w-sm p-8 text-center">
        {ok ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
        ) : (
          <XCircle className="mx-auto h-12 w-12 text-danger" />
        )}
        <h1 className="mt-4 text-xl font-bold">{ok ? "Email verified" : "Verification failed"}</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Link
          href={ok ? "/dashboard" : "/signin"}
          className="mt-6 inline-block w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          {ok ? "Go to dashboard" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
