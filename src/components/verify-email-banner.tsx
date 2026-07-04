"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";

export function VerifyEmailBanner() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setErrorMsg(null);
    const res = await fetch("/api/verify-email/resend", { method: "POST" });
    if (res.ok) {
      setState("sent");
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error ?? null);
      setState("error");
    }
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
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <button
            type="button"
            onClick={resend}
            disabled={state === "sending"}
            className="font-semibold text-gold hover:underline disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : state === "error" ? "Retry" : "Resend email"}
          </button>
          {state === "error" && errorMsg && (
            <span className="max-w-[16rem] text-right text-xs text-danger">{errorMsg}</span>
          )}
        </div>
      )}
    </div>
  );
}
