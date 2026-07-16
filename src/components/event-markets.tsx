"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/odds";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";

interface Section {
  key: string;
  label: string;
  options: MarketOption[];
}
interface Group {
  key: string;
  label: string;
  sections: Section[];
}

// Build a provisional tree from the board's game lines so something shows
// instantly while the full per-event set loads.
function initialGroups(markets: MarketOption[]): Group[] {
  const buckets: Record<string, { key: string; label: string; options: MarketOption[] }> = {
    MONEYLINE: { key: "moneyline", label: "Moneyline", options: [] },
    SPREAD: { key: "spread", label: "Spread", options: [] },
    TOTAL: { key: "total", label: "Total", options: [] },
  };
  for (const m of markets) buckets[m.betType]?.options.push(m);
  const sections = ["MONEYLINE", "SPREAD", "TOTAL"]
    .map((k) => buckets[k])
    .filter((s) => s.options.length > 0);
  return sections.length ? [{ key: "game", label: "Game Lines", sections }] : [];
}

const sectionId = (groupKey: string, sectionKey: string) => `${groupKey}:${sectionKey}`;

function defaultOpen(groups: Group[]) {
  const g = groups[0];
  return {
    groups: new Set<string>(g ? [g.key] : []),
    sections: new Set<string>(g?.sections[0] ? [sectionId(g.key, g.sections[0].key)] : []),
  };
}

/**
 * Nested market picker shown under an expanded game: Game Lines / Player Props
 * → per-market subsection → individual lines. The board's game lines render
 * instantly; opening the game fetches the full per-event set (props for US
 * sports, non-player markets for soccer) and replaces the tree.
 *
 * Mount with `key={event.id}` so switching games starts fresh.
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
  const seed = initialGroups(event.markets);
  const [groups, setGroups] = useState<Group[]>(seed);
  const [bookmaker, setBookmaker] = useState<string | null>(event.bookmaker);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(defaultOpen(seed).groups);
  const [openSections, setOpenSections] = useState<Set<string>>(defaultOpen(seed).sections);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ sport, sportKey: event.sportKey });
    fetch(`/api/odds/event/${event.id}?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data: { groups?: Group[]; bookmaker?: string | null }) => {
        if (!active) return;
        const g = data.groups ?? [];
        if (g.length > 0) {
          setGroups(g);
          setBookmaker(data.bookmaker ?? event.bookmaker);
          const d = defaultOpen(g);
          setOpenGroups(d.groups);
          setOpenSections(d.sections);
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

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const toggleGroup = (k: string) => toggle(setOpenGroups, k);
  const toggleSection = (id: string) => toggle(setOpenSections, id);

  if (groups.length === 0) {
    return (
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted">Loading markets…</p>
        ) : (
          <p className="text-sm text-muted">No odds posted for this game yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {groups.map((group) => {
          const groupOpen = openGroups.has(group.key);
          const count = group.sections.reduce((n, s) => n + s.options.length, 0);
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center justify-between gap-2 bg-surface-raised px-3 py-2.5 text-left text-sm font-semibold"
              >
                <span className="flex items-center gap-1.5">
                  {groupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {group.label}
                </span>
                <span className="text-xs font-normal text-muted">
                  {group.sections.length} markets · {count} lines
                </span>
              </button>

              {groupOpen && (
                <div className="divide-y divide-border">
                  {group.sections.map((section) => {
                    const id = sectionId(group.key, section.key);
                    const sectionOpen = openSections.has(id);
                    return (
                      <div key={id} className="bg-surface">
                        <button
                          type="button"
                          onClick={() => toggleSection(id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 pl-6 text-left text-sm"
                        >
                          <span className="flex items-center gap-1.5">
                            {sectionOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted" />
                            )}
                            <span className="font-medium">{section.label}</span>
                          </span>
                          <span className="text-[11px] text-muted">{section.options.length}</span>
                        </button>

                        {sectionOpen && (
                          <ul className="max-h-56 overflow-y-auto pb-1">
                            {section.options.map((market, i) => {
                              const active = selected === market;
                              return (
                                <li key={`${market.selection}-${i}`}>
                                  <button
                                    type="button"
                                    onClick={() => onSelect(market)}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 pl-9 text-left text-xs",
                                      active ? "bg-accent/10 text-accent" : "hover:bg-surface-raised"
                                    )}
                                  >
                                    <span className="font-display">{market.selection}</span>
                                    <span className="shrink-0 font-display font-medium tabular-nums">
                                      {formatOdds(market.odds)}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading && <p className="text-[11px] text-muted">Loading player props &amp; more markets…</p>}
      {bookmaker && <p className="text-[11px] text-muted">Odds via {bookmaker}</p>}
    </div>
  );
}
