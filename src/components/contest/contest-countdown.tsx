"use client";

import { useEffect, useState } from "react";

// Live countdown to a target time. Shows "0d 0h 0m 0s" once elapsed. Renders a
// stable placeholder on first paint to avoid a hydration mismatch.
export function ContestCountdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Seed the first value in a callback (not synchronously in the effect body)
    // so it runs client-side right after paint without a hydration mismatch.
    const seed = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(seed);
      clearInterval(id);
    };
  }, []);

  const remaining = now == null ? null : Math.max(0, new Date(target).getTime() - now);

  const parts = (() => {
    if (remaining == null) return null;
    const s = Math.floor(remaining / 1000);
    return {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
    };
  })();

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <span className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center gap-2.5 tabular-nums sm:gap-3.5">
        {(["d", "h", "m", "s"] as const).map((k) => (
          <div key={k} className="flex flex-col items-center">
            <span className="min-w-[3.75rem] rounded-xl bg-surface-raised px-3 py-3 text-center text-4xl font-extrabold leading-none shadow-sm sm:min-w-[4.75rem] sm:px-4 sm:py-4 sm:text-6xl">
              {parts ? String(parts[k]).padStart(2, "0") : "––"}
            </span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {k === "d" ? "days" : k === "h" ? "hrs" : k === "m" ? "min" : "sec"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
