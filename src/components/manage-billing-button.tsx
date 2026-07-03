"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (body.url) window.location.href = body.url;
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-lg border border-border py-2 text-sm font-medium hover:border-muted disabled:opacity-60"
    >
      {loading ? "Loading…" : "Manage billing"}
    </button>
  );
}
