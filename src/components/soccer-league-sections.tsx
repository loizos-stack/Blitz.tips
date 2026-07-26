"use client";

import type { ReactNode } from "react";
import { LeagueBadge } from "@/components/team-logo";
import { groupSoccerEvents } from "@/lib/soccer-leagues";

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
 * The caller keeps ownership of the match row itself via `renderEvent`, so the
 * two pick forms can group identically while keeping their own row layouts.
 */
export function SoccerLeagueSections<
  T extends { id: string; sportKey: string; leagueLogo: string | null },
>({ events, renderEvent }: { events: T[]; renderEvent: (event: T) => ReactNode }) {
  const countries = groupSoccerEvents(events);

  return (
    <>
      {countries.map((country) => (
        <div key={country.country} className="flex flex-col gap-2">
          <p className="flex items-center gap-2 border-b border-border pb-1 font-display text-sm font-semibold">
            {country.flag && (
              <span aria-hidden className="text-base leading-none">
                {country.flag}
              </span>
            )}
            {country.country}
          </p>

          {country.leagues.map((league) => (
            <div key={league.key} className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <LeagueBadge src={league.events[0]?.leagueLogo ?? null} className="h-4 w-4" />
                {league.league}
              </p>
              {league.events.map((event) => renderEvent(event))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
