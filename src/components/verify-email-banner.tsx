"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";

export function VerifyEmailBanner() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setState("sending");
    const res = await fetch("/api/verify-email/resend", { method: "POST" });
    setState(res.ok ? "sent" : "error");
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
      <MailWarning className="h-4 w-4 shrink-0 text-gold" />
      <p className="flex-1 text-foreground">
        Please verify your email to unlock posting picks and subscribing. Check your inbox for the link.
      </p>
      {state === "sent" ? (
        <span className="font-medium text-accent">Verification email sent ✓</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={state === "sending"}
          className="shrink-0 font-semibold text-gold hover:underline disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : state === "error" ? "Retry" : "Resend email"}
        </button>
      )}
    </div>
  );
}
