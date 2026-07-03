"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/utils";

export function SubscribeButton({
  handicapperId,
  priceCents,
  isSignedIn,
  isReady,
}: {
  handicapperId: string;
  priceCents: number;
  isSignedIn: boolean;
  isReady: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isSignedIn) {
      router.push(`/signin?callbackUrl=/handicappers`);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not start checkout");
      return;
    }
    if (body.url) window.location.href = body.url;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || !isReady}
        className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!isReady
          ? "Subscriptions not yet enabled"
          : loading
            ? "Redirecting…"
            : `Subscribe — ${formatCents(priceCents)}/mo`}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
