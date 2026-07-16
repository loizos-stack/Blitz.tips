"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/odds";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";

interface Category {
  key: string;
  label: string;
  options: MarketOption[];
}

/**
 * The categorized market picker shown under an expanded game in the pick form.
 * The bulk board only carries game lines, so on open this fetches the full
 * per-event set (player props for US sports, non-player extras for soccer),
 * groups it into categories, and offers a category nav. Game lines from the
 * board render instantly while the richer set loads.
 *
 * Mount it with `key={event.id}` so switching games starts fresh.
 */
export function EventMarkets({
  sport,
  event,
  selected,
  onSelect,
}: {
  sport: string;
  event: UpcomingEvent;
  selected: MarketOption | null;
  onSelect: (market: MarketOption) => void;
}) {
  const initial: Category[] = event.markets.length
    ? [{ key: "game", label: "Game Lines", options: event.markets }]
    : [];
  const [categories, setCategories] = useState<Category[]>(initial);
  const [bookmaker, setBookmaker] = useState<string | null>(event.bookmaker);
  const [activeCat, setActiveCat] = useState("game");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ sport, sportKey: event.sportKey });
    fetch(`/api/odds/event/${event.id}?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data: { categories?: Category[]; bookmaker?: string | null }) => {
        if (!active) return;
        const cats = data.categories ?? [];
        if (cats.length > 0) {
          setCategories(cats);
          setBookmaker(data.bookmaker ?? event.bookmaker);
          setActiveCat((prev) => (cats.some((c) => c.key === prev) ? prev : cats[0].key));
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [event.id, event.sportKey, event.bookmaker, sport]);

  const active = categories.find((c) => c.key === activeCat) ?? categories[0] ?? null;

  return (
    <div className="space-y-2">
      {categories.length > 1 && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCat(c.key)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                c.key === active?.key
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-raised text-muted hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {active && active.options.length > 0 ? (
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
          {active.options.map((market, i) => (
            <button
              key={`${market.selection}-${i}`}
              type="button"
              onClick={() => onSelect(market)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-display text-xs font-medium tabular-nums",
                selected === market
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              {market.selection} {formatOdds(market.odds)}
            </button>
          ))}
        </div>
      ) : (
        !loading && <p className="text-sm text-muted">No odds posted for this game yet.</p>
      )}

      {loading && <p className="text-[11px] text-muted">Loading player props &amp; more markets…</p>}
      {bookmaker && <p className="text-[11px] text-muted">Odds via {bookmaker}</p>}
    </div>
  );
}
