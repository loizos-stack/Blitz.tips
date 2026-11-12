"use client";

import { useEffect, useState } from "react";

// Live countdown to a target time. Shows "0d 0h 0m 0s" once elapsed. Renders a
// stable placeholder on first paint to avoid a hydration mismatch.
export function ContestCountdown({
  target,
  label,
  onDark = false,
  compact = false,
}: {
  target: string;
  label: string;
  /** Restyles the tiles for a dark surface — the light ones vanish on charcoal. */
  onDark?: boolean;
  /** Smaller tiles, for a sidebar column where the page-header size overflows. */
  compact?: boolean;
}) {
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
      <span
        className={`text-sm font-semibold uppercase tracking-wide ${onDark ? "text-white/60" : "text-muted"}`}
      >
        {label}
      </span>
      <div className="flex items-center gap-2.5 tabular-nums sm:gap-3.5">
        {(["d", "h", "m", "s"] as const).map((k) => (
          <div key={k} className="flex flex-col items-center">
            <span
              className={`rounded-xl text-center font-extrabold leading-none shadow-sm ${
                compact
                  ? "min-w-[2.75rem] px-2 py-2 text-2xl"
                  : "min-w-[3.75rem] px-3 py-3 text-4xl sm:min-w-[4.75rem] sm:px-4 sm:py-4 sm:text-6xl"
              } ${onDark ? "border border-white/10 bg-white/10 text-white" : "bg-surface-raised"}`}
            >
              {parts ? String(parts[k]).padStart(2, "0") : "––"}
            </span>
            <span
              className={`mt-2 text-xs font-semibold uppercase tracking-wide ${onDark ? "text-white/50" : "text-muted"}`}
            >
              {k === "d" ? "days" : k === "h" ? "hrs" : k === "m" ? "min" : "sec"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
