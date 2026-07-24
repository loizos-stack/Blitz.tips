"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ListFilter, Check } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";
import { SPORT_LABELS } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

// Sport filter as a custom dropdown (not a native <select>, which can't render
// the SVG sport icons), navigating on change so the server component re-renders
// with the chosen filter. Used on the leaderboard and the handicappers directory.
export function SportFilterSelect({
  basePath,
  sort,
  sport,
}: {
  basePath: string;
  sort: string;
  sport?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(value: string) {
    setOpen(false);
    router.push(`${basePath}?sort=${sort}${value !== "all" ? `&sport=${value}` : ""}`);
  }

  const current = sport && sport in SPORT_LABELS ? (sport as PickSport) : null;
  const options: Array<{ value: string; label: string }> = [
    { value: "all", label: "All sports" },
    ...Object.entries(SPORT_LABELS).map(([value, label]) => ({ value, label })),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by sport"
        className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium outline-none hover:border-muted focus:border-accent"
      >
        {current ? (
          <SportIcon sport={current} className="h-4 w-4" />
        ) : (
          <ListFilter className="h-4 w-4 text-muted" />
        )}
        {current ? SPORT_LABELS[current] : "All sports"}
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-48 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {options.map((opt) => {
            const selected = opt.value === (sport ?? "all");
            return (
              <li key={opt.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => select(opt.value)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-surface-raised ${
                    selected ? "font-semibold text-accent" : ""
                  }`}
                >
                  {opt.value === "all" ? (
                    <ListFilter className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <SportIcon sport={opt.value as PickSport} className="h-4 w-4 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{opt.label}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
