"use client";

import { useRouter } from "next/navigation";
import { SPORT_LABELS } from "@/lib/utils";

// Sport filter for the leaderboard as a dropdown, navigating on change so the
// server component re-renders with the chosen filter.
export function SportFilterSelect({ sort, sport }: { sort: string; sport?: string }) {
  const router = useRouter();

  return (
    <select
      value={sport ?? "all"}
      onChange={(e) => {
        const value = e.target.value;
        router.push(`/leaderboard?sort=${sort}${value !== "all" ? `&sport=${value}` : ""}`);
      }}
      aria-label="Filter by sport"
      className="cursor-pointer rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium outline-none hover:border-muted focus:border-accent"
    >
      <option value="all">All sports</option>
      {Object.entries(SPORT_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
