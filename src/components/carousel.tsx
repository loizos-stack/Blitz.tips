"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll carousel with hidden scrollbar, scroll-snap, edge fades,
 * and chevron buttons that appear only when there's more to scroll in that
 * direction. Extracted from the "Find a Handicapper" filter row so the same
 * treatment can wrap any row of cards/chips.
 */
export function Carousel({
  children,
  className,
  trackClassName,
  gapClass = "gap-2",
  /** Tailwind `from-*` class for the edge-fade gradient — match the section bg. */
  fadeFromClass = "from-background",
  /** Minimum px a chevron click scrolls (falls back to 70% of the visible width). */
  step = 220,
}: {
  children: React.ReactNode;
  className?: string;
  trackClassName?: string;
  gapClass?: string;
  fadeFromClass?: string;
  step?: number;
}) {
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
    trackRef.current?.scrollBy({
      left: dir * Math.max(step, trackRef.current.clientWidth * 0.7),
      behavior: "smooth",
    });

  const arrow =
    "absolute top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-md transition hover:text-foreground";

  return (
    <div className={cn("relative min-w-0", className)}>
      {!atStart && (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r to-transparent",
              fadeFromClass
            )}
          />
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => nudge(-1)}
            className={cn(arrow, "left-0")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      )}

      <div
        ref={trackRef}
        className={cn(
          "flex snap-x overflow-x-auto scroll-smooth px-0.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          gapClass,
          trackClassName
        )}
      >
        {children}
      </div>

      {!atEnd && (
        <>
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l to-transparent",
              fadeFromClass
            )}
          />
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => nudge(1)}
            className={cn(arrow, "right-0")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
