import Link from "next/link";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { HOMEPAGE_SPORTS, type OddsFeedResult } from "@/lib/odds-api";
import type { PickSport } from "@prisma/client";

export function UpcomingGames({ sport, feed }: { sport: PickSport; feed: OddsFeedResult }) {
  if (!feed.configured) return null;

  return (
    <section className="border-b border-border bg-surface/60 py-14">
      <div className="container-page">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Today&apos;s lines</h2>
            <p className="mt-1 text-muted">Live moneyline, spread, and total odds from the board.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {HOMEPAGE_SPORTS.map((s) => (
              <Link
                key={s}
                href={`/?sport=${s}#lines`}
                scroll={false}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium",
                  s === sport
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-foreground"
                )}
              >
                {SPORT_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {!feed.supported ? (
          <p className="text-muted">Live odds for {SPORT_LABELS[sport]} aren&apos;t available.</p>
        ) : feed.events.length === 0 ? (
          <p className="text-muted">No upcoming {SPORT_LABELS[sport]} games on the board right now.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {feed.events.slice(0, 8).map((event) => (
              <div key={event.id} className="card w-72 shrink-0 p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {format(new Date(event.commenceTime), "EEE, MMM d · h:mm a")}
                </div>
                <p className="mt-2 font-semibold leading-snug">{event.matchup}</p>

                {event.markets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {event.markets.slice(0, 4).map((market, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium tabular-nums"
                      >
                        {market.selection} {formatOdds(market.odds)}
                      </span>
                    ))}
                  </div>
                )}

                {event.bookmaker && <p className="mt-2 text-[11px] text-muted">Odds via {event.bookmaker}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
