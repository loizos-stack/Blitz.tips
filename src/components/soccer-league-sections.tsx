"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { FlagIcon } from "@/components/flag-icon";
import { LeagueBadge } from "@/components/team-logo";
import { groupSoccerEvents } from "@/lib/soccer-leagues";
import { cn } from "@/lib/utils";

/**
 * Country → league → matches for a soccer schedule list.
 *
 * Every other sport in the pick forms is a single league, so a flat list of
 * matchups is unambiguous. Soccer isn't: one feed mixes a dozen competitions
 * across as many countries, and "Fluminense vs Grêmio" means nothing without
 * knowing whether it's Série A or the Libertadores. The headings do that work,
 * and they also make a long list scannable — you find your league, not your
 * kickoff time.
 *
 * Countries collapse, and they all start closed. A busy midweek across twenty
 * leagues is hundreds of rows, and scrolling past nineteen countries to reach
 * yours is worse than one click. Closed by default means the whole card is one
 * screen you can read at a glance — pick your country, open it, and everything
 * else stays out of the way.
 *
 * The caller keeps ownership of the match row itself via `renderEvent`, so the
 * two pick forms can group identically while keeping their own row layouts.
 */
export function SoccerLeagueSections<
  T extends { id: string; sportKey: string; leagueLogo: string | null },
>({ events, renderEvent }: { events: T[]; renderEvent: (event: T) => ReactNode }) {
  const countries = groupSoccerEvents(events);
  const [openCountries, setOpenCountries] = useState<Record<string, boolean>>({});

  return (
    <>
      {countries.map((country) => {
        const open = Boolean(openCountries[country.country]);
        const matches = country.leagues.reduce((sum, l) => sum + l.events.length, 0);

        return (
          <div key={country.country} className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                setOpenCountries((prev) => ({ ...prev, [country.country]: !open }))
              }
              aria-expanded={open}
              className="flex w-full items-center gap-2 border-b border-border pb-1 text-left font-display text-sm font-semibold transition-colors hover:text-brand"
            >
              <FlagIcon code={country.code} className="h-3.5" />
              <span className="min-w-0 flex-1 truncate">{country.country}</span>
              <span className="shrink-0 text-xs font-medium text-muted">
                {matches} {matches === 1 ? "match" : "matches"}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </button>

            {open &&
              country.leagues.map((league) => (
                <div key={league.key} className="flex flex-col gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <LeagueBadge src={league.events[0]?.leagueLogo ?? null} className="h-4 w-4" />
                    {league.league}
                  </p>
                  {league.events.map((event) => renderEvent(event))}
                </div>
              ))}
          </div>
        );
      })}
    </>
  );
}
