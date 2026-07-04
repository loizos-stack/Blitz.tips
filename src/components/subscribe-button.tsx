"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents, cn } from "@/lib/utils";

type PackageInterval = "WEEKLY" | "MONTHLY" | "ANNUAL";

const INTERVAL_SUFFIX: Record<PackageInterval, string> = {
  WEEKLY: "/wk",
  MONTHLY: "/mo",
  ANNUAL: "/yr",
};

const INTERVAL_LABEL: Record<PackageInterval, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
};

export function SubscribeButton({
  handicapperId,
  packages,
  isSignedIn,
  isReady,
}: {
  handicapperId: string;
  // Cents per offered package; null = the handicapper doesn't offer it.
  packages: { WEEKLY: number | null; MONTHLY: number; ANNUAL: number | null };
  isSignedIn: boolean;
  isReady: boolean;
}) {
  const router = useRouter();
  const offered = (Object.keys(INTERVAL_SUFFIX) as PackageInterval[]).filter(
    (i) => packages[i] != null
  );
  const [interval, setInterval] = useState<PackageInterval>("MONTHLY");
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
      body: JSON.stringify({ handicapperId, interval }),
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
      {offered.length > 1 && (
        <div className="mb-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${offered.length}, 1fr)` }}>
          {offered.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={cn(
                "rounded-lg border px-2 py-2 text-center",
                interval === i
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-muted"
              )}
            >
              <span className="block text-xs text-muted">{INTERVAL_LABEL[i]}</span>
              <span className="block text-sm font-semibold tabular-nums">
                {formatCents(packages[i]!)}
                <span className="font-normal text-muted">{INTERVAL_SUFFIX[i]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={loading || !isReady}
        className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!isReady
          ? "Subscriptions not yet enabled"
          : loading
            ? "Redirecting…"
            : `Subscribe — ${formatCents(packages[interval]!)}${INTERVAL_SUFFIX[interval]}`}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
