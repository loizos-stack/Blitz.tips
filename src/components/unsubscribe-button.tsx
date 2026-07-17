"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function unsubscribe() {
    setState("busy");
    try {
      const res = await fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 font-semibold text-accent">
          <Check className="h-5 w-5" /> You&rsquo;ve been unsubscribed.
        </p>
        <p className="text-sm text-muted">
          You&rsquo;ll no longer receive marketing or notification emails. You can turn them back on any
          time from your{" "}
          <Link href="/settings/notifications" className="text-accent hover:underline">
            notification settings
          </Link>
          . Account and support emails (like receipts and replies) still work.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={unsubscribe}
        disabled={state === "busy"}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
      </button>
      {state === "error" && <p className="text-sm text-danger">Something went wrong — please try again.</p>}
      <p className="text-sm text-muted">
        Prefer to fine-tune what you get instead?{" "}
        <Link href="/settings/notifications" className="text-accent hover:underline">
          Manage notification settings
        </Link>
        .
      </p>
    </div>
  );
}
