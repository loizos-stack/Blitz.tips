"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Flame, Heart, Star } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";
import { SPORT_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

interface Props {
  /** Sports actually offered by at least one handicapper — drives the sport chips. */
  sports: PickSport[];
  /** The active filter key ("all" | "hot" | "followed" | "reviewed" | a PickSport). */
  activeFilter: string;
  query: string;
}

const SPECIAL_CHIPS = [
  { key: "hot", label: "Hot", Icon: Flame, iconClass: "text-orange-500" },
  { key: "followed", label: "Most followed", Icon: Heart, iconClass: "text-danger" },
  { key: "reviewed", label: "Most reviewed", Icon: Star, iconClass: "text-gold" },
] as const;

export function HandicapperFinder({ sports, activeFilter, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(query);

  // Build a URL that changes only the finder params, preserving everything else
  // (e.g. the ?sport= board tab).
  const buildUrl = useCallback(
    (next: { find?: string; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if ("find" in next) {
        if (!next.find || next.find === "all") params.delete("find");
        else params.set("find", next.find);
      }
      if ("q" in next) {
        if (next.q) params.set("q", next.q);
        else params.delete("q");
      }
      const qs = params.toString();
      return qs ? `${pathname}?${qs}#find` : `${pathname}#find`;
    },
    [pathname, searchParams]
  );

  // Debounce the search box so we don't navigate on every keystroke.
  useEffect(() => {
    if (text === query) return;
    const id = setTimeout(() => router.replace(buildUrl({ q: text }), { scroll: false }), 300);
    return () => clearTimeout(id);
  }, [text, query, router, buildUrl]);

  const setFilter = (key: string) =>
    router.replace(buildUrl({ find: key === activeFilter ? "all" : key }), { scroll: false });

  const isActive = (key: string) =>
    key === activeFilter || (key === "all" && (activeFilter === "all" || !activeFilter));

  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "border-accent bg-accent/10 text-accent"
        : "border-border text-muted hover:border-muted hover:text-foreground"
    );

  return (
    <div className="mt-5 space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search handicappers by name or @handle…"
          className="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("all")} className={chip(isActive("all"))}>
          All
        </button>
        {SPECIAL_CHIPS.map(({ key, label, Icon, iconClass }) => (
          <button key={key} type="button" onClick={() => setFilter(key)} className={chip(isActive(key))}>
            <Icon className={cn("h-4 w-4", iconClass)} />
            {label}
          </button>
        ))}
        {sports.map((sport) => (
          <button key={sport} type="button" onClick={() => setFilter(sport)} className={chip(isActive(sport))}>
            <SportIcon sport={sport} className="h-4 w-4" />
            {SPORT_LABELS[sport] ?? sport}
          </button>
        ))}
      </div>
    </div>
  );
}
