"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Flame, Heart, Star, PersonStanding, BookText, ChevronLeft, ChevronRight } from "lucide-react";
import { SportIcon } from "@/components/sport-icon";
import { SPORT_LABELS, cn } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

interface Props {
  /** Major sports offered by at least one handicapper — drives the sport chips. */
  sports: PickSport[];
  /** The active filter key ("all" | "hot" | "followed" | "reviewed" | a PickSport). */
  activeFilter: string;
  query: string;
}

const SPECIAL_CHIPS = [
  { key: "hot", label: "Hot", Icon: Flame, iconClass: "text-orange-500" },
  { key: "followed", label: "Most followed", Icon: Heart, iconClass: "text-danger" },
  { key: "reviewed", label: "Most reviewed", Icon: Star, iconClass: "text-gold" },
  { key: "props", label: "Player Props", Icon: PersonStanding, iconClass: "text-accent" },
  { key: "parlays", label: "Parlays", Icon: BookText, iconClass: "text-accent" },
] as const;

export function HandicapperFinder({ sports, activeFilter, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(query);

  // Carousel scroll affordances: chevrons appear only when there's more to
  // scroll in that direction, and edge fades hint at the overflow.
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncEdges();
    el.addEventListener("scroll", syncEdges, { passive: true });
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncEdges);
      ro.disconnect();
    };
  }, [syncEdges]);

  const nudge = (dir: 1 | -1) =>
    trackRef.current?.scrollBy({ left: dir * Math.max(220, trackRef.current.clientWidth * 0.7), behavior: "smooth" });

  // Build a URL that changes only the finder params, preserving everything else
  // (e.g. the ?sport= board tab). Clicking the active chip resets to "all".
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
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  // Debounce the search box so we don't navigate on every keystroke.
  useEffect(() => {
    if (text === query) return;
    const id = setTimeout(() => router.replace(buildUrl({ q: text }), { scroll: false }), 300);
    return () => clearTimeout(id);
  }, [text, query, router, buildUrl]);

  const isActive = (key: string) =>
    key === activeFilter || (key === "all" && (activeFilter === "all" || !activeFilter));

  const hrefFor = (key: string) => buildUrl({ find: key === activeFilter ? "all" : key });

  const chip = (active: boolean) =>
    cn(
      "inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
      active
        ? "border-accent bg-accent/10 text-accent shadow-sm"
        : "border-border bg-surface text-muted shadow-sm hover:border-accent/40 hover:text-foreground"
    );

  const arrow =
    "absolute top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-md transition hover:text-foreground";

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative shrink-0 sm:w-60 lg:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search handicappers, picks, teams…"
          className="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>

      {/* Filter carousel next to the search bar: hidden scrollbar, scroll-snap,
          edge fades, and chevrons that appear only when there's more to scroll. */}
      <div className="relative min-w-0 sm:flex-1">
        {!atStart && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent" />
            <button
              type="button"
              aria-label="Scroll filters left"
              onClick={() => nudge(-1)}
              className={cn(arrow, "left-0")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}

        <div
          ref={trackRef}
          className="flex snap-x gap-2 overflow-x-auto scroll-smooth px-0.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link href={hrefFor("all")} scroll={false} className={chip(isActive("all"))}>
            All
          </Link>
          {SPECIAL_CHIPS.map(({ key, label, Icon, iconClass }) => (
            <Link key={key} href={hrefFor(key)} scroll={false} className={chip(isActive(key))}>
              <Icon className={cn("h-4 w-4", iconClass)} />
              {label}
            </Link>
          ))}
          {sports.map((sport) => (
            <Link key={sport} href={hrefFor(sport)} scroll={false} className={chip(isActive(sport))}>
              <SportIcon sport={sport} className="h-4 w-4" />
              {SPORT_LABELS[sport] ?? sport}
            </Link>
          ))}
        </div>

        {!atEnd && (
          <>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
            <button
              type="button"
              aria-label="Scroll filters right"
              onClick={() => nudge(1)}
              className={cn(arrow, "right-0")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
