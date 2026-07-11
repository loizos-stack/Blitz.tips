import Link from "next/link";
import { CalendarClock, Radio } from "lucide-react";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, cn } from "@/lib/utils";
import type { OddsFeedResult, UpcomingEvent, MarketOption } from "@/lib/odds-api";
import { SportIcon } from "@/components/sport-icon";
import { TeamLogo } from "@/components/team-logo";
import { LocalTime } from "@/components/local-time";
import type { PickSport } from "@prisma/client";

interface OddsBoard {
  spread: { away: MarketOption | null; home: MarketOption | null };
  total: { over: MarketOption | null; under: MarketOption | null };
  moneyline: { away: MarketOption | null; home: MarketOption | null };
}

function buildOddsBoard(event: UpcomingEvent): OddsBoard {
  const bySelectionStart = (prefix: string, betType: MarketOption["betType"]) =>
    event.markets.find((m) => m.betType === betType && m.selection.startsWith(prefix)) ?? null;

  return {
    spread: {
      away: bySelectionStart(event.awayTeam, "SPREAD"),
      home: bySelectionStart(event.homeTeam, "SPREAD"),
    },
    total: {
      over: bySelectionStart("Over", "TOTAL"),
      under: bySelectionStart("Under", "TOTAL"),
    },
    moneyline: {
      away: bySelectionStart(event.awayTeam, "MONEYLINE"),
      home: bySelectionStart(event.homeTeam, "MONEYLINE"),
    },
  };
}

function cell(market: MarketOption | null) {
  if (!market) return <span className="text-muted">—</span>;
  const point = market.point !== undefined ? `${market.point > 0 ? "+" : ""}${market.point}` : null;
  return (
    <span className="tabular-nums">
      {point && <span className="font-semibold">{point} </span>}
      <span className={point ? "text-muted" : "font-semibold"}>{formatOdds(market.odds)}</span>
    </span>
  );
}

export function UpcomingGames({
  sport,
  feed,
  availableSports,
}: {
  // Null until the visitor picks a tab — odds are fetched on demand to
  // conserve API credits, so the initial homepage render shows the tab bar
  // with a prompt instead of a pre-fetched board.
  sport: PickSport | null;
  feed: OddsFeedResult | null;
  availableSports: PickSport[];
}) {
  // Empty only when THE_ODDS_API_KEY is unset — hide the section entirely.
  if (availableSports.length === 0) return null;
  if (feed && !feed.configured) return null;

  return (
    <section className="relative overflow-hidden border-b border-border bg-surface/60 py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/lines-bg.svg')] bg-cover bg-center"
      />
      <div className="container-page relative">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Today&apos;s lines</h2>
            <p className="mt-1 text-muted">Live moneyline, spread, and total odds from the board.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSports.map((s) => (
              <Link
                key={s}
                href={`/?sport=${s}#lines`}
                scroll={false}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-display text-sm font-medium",
                  s === sport
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-foreground"
                )}
              >
                <SportIcon sport={s} className="h-4 w-4" />
                {SPORT_LABELS[s]}
              </Link>
            ))}
          </div>
        </div>

        {!sport || !feed ? (
          <p className="text-muted">Pick a sport above to see the latest lines.</p>
        ) : !feed.supported ? (
          <p className="text-muted">Live odds for {SPORT_LABELS[sport]} aren&apos;t available.</p>
        ) : feed.events.length === 0 ? (
          <p className="text-muted">No upcoming {SPORT_LABELS[sport]} games on the board right now.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {feed.events.slice(0, 8).map((event) => {
              const board = buildOddsBoard(event);
              const isLive = Boolean(event.liveScore) && !event.liveScore?.completed;
              const isFinal = event.liveScore?.completed;

              return (
                <div key={event.id} className="card w-80 shrink-0 p-4">
                  <div className="flex items-center justify-between text-xs">
                    {isLive ? (
                      <span className="flex items-center gap-1 font-semibold text-danger">
                        <Radio className="h-3 w-3 animate-pulse" /> LIVE
                      </span>
                    ) : isFinal ? (
                      <span className="font-semibold text-muted">FINAL</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <LocalTime iso={event.commenceTime} />
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5">
                    <TeamLogo sport={sport} logoUrl={event.awayTeamLogo} className="h-7 w-7 shrink-0" />
                    <p className="min-w-0 truncate font-display text-sm font-semibold">{event.awayTeam}</p>
                    <p className="text-sm font-bold tabular-nums">{event.liveScore?.awayScore ?? ""}</p>

                    <TeamLogo sport={sport} logoUrl={event.homeTeamLogo} className="h-7 w-7 shrink-0" />
                    <p className="min-w-0 truncate font-display text-sm font-semibold">{event.homeTeam}</p>
                    <p className="text-sm font-bold tabular-nums">{event.liveScore?.homeScore ?? ""}</p>
                  </div>

                  {event.markets.length > 0 && (
                    <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1 border-t border-border pt-2 text-xs">
                      <span />
                      <span className="text-right font-medium text-muted">Spread</span>
                      <span className="text-right font-medium text-muted">Total</span>
                      <span className="text-right font-medium text-muted">ML</span>

                      <span className="truncate text-muted">Away</span>
                      <span className="text-right">{cell(board.spread.away)}</span>
                      <span className="text-right">{cell(board.total.over)}</span>
                      <span className="text-right">{cell(board.moneyline.away)}</span>

                      <span className="truncate text-muted">Home</span>
                      <span className="text-right">{cell(board.spread.home)}</span>
                      <span className="text-right">{cell(board.total.under)}</span>
                      <span className="text-right">{cell(board.moneyline.home)}</span>
                    </div>
                  )}

                  {event.bookmaker && <p className="mt-2 text-[11px] text-muted">Odds via {event.bookmaker}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
