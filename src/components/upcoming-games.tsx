import { Fragment } from "react";
import Link from "next/link";
import { CalendarClock, Radio } from "lucide-react";
import { SportsbookCta } from "@/components/sportsbook-cta";
import type { Sportsbook } from "@/lib/sportsbooks";
import { Odds } from "@/components/odds-format";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { isMoneylineOnly } from "@/lib/odds-api";
import type { OddsFeedResult, UpcomingEvent, MarketOption } from "@/lib/odds-api";
import { soccerLeagueMeta } from "@/lib/soccer-leagues";
import { FlagIcon } from "@/components/flag-icon";
import { SportIcon } from "@/components/sport-icon";
import { TeamLogo } from "@/components/team-logo";
import { LocalTime } from "@/components/local-time";
import { Carousel } from "@/components/carousel";
import type { PickSport } from "@prisma/client";

interface OddsBoard {
  spread: { away: MarketOption | null; home: MarketOption | null };
  total: { over: MarketOption | null; under: MarketOption | null };
  /**
   * `draw` is the third outcome of a soccer moneyline. Null for every other
   * sport, where a tie either can't happen or isn't separately priced.
   */
  moneyline: { away: MarketOption | null; home: MarketOption | null; draw: MarketOption | null };
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
      // Matched on `side` rather than the selection text, because "Draw" is a
      // side rather than a team and both the paid feed and the ESPN fallback
      // label it that way.
      draw:
        event.markets.find((m) => m.betType === "MONEYLINE" && m.side === "Draw") ?? null,
    },
  };
}

function cell(market: MarketOption | null) {
  if (!market) return <span className="text-muted">—</span>;
  const point = market.point !== undefined ? `${market.point > 0 ? "+" : ""}${market.point}` : null;
  return (
    <span className="tabular-nums">
      {point && <span className="font-semibold">{point} </span>}
      <span className={point ? "text-muted" : "font-semibold"}><Odds value={market.odds} /></span>
    </span>
  );
}

export function UpcomingGames({
  sport,
  feed,
  availableSports,
  book = null,
}: {
  /** Renders the Stake partner CTA. Caller must have geo-gated to non-US. */
  book?: Sportsbook | null;
  // Null on the default "all sports" view — the board merges every sport's
  // games sorted by start time. A non-null value means the visitor narrowed to
  // a single sport via a pill.
  sport: PickSport | null;
  feed: OddsFeedResult | null;
  availableSports: PickSport[];
}) {
  // Empty only when THE_ODDS_API_KEY is unset — hide the section entirely.
  if (availableSports.length === 0) return null;
  if (feed && !feed.configured) return null;

  // The all-sports view shows a mixed board, so which sport each card is for is
  // decided per event; a single-sport view just repeats the selected sport.
  const mixed = sport === null;
  // Narrowing to a sport must never show less of that sport than the mixed
  // board did, so the single-sport cap stays above the merged one. These are
  // horizontal carousels, so extra cards cost a scroll rather than page height.
  // Soccer isn't one league, it's up to MAX_SOCCER_LEAGUES of them on one
  // board, and they kick off in country order through the day — so a 20-card
  // cap quietly cut the European evening games, which are the ones people came
  // for. These are horizontal carousels, so extra cards cost a scroll rather
  // than page height.
  const eventCap = sport === "SOCCER" ? 48 : sport ? 20 : 16;

  // The fallback board is all-or-nothing per sport, so one ESPN event means
  // this view is the free board.
  const fromEspn = Boolean(feed?.events.some((e) => e.source === "espn"));

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
            {/* Said plainly when the free fallback is in use. These are one
                provider's numbers rather than a shopped market, and a board
                that doesn't distinguish the two is quietly overstating what it
                is showing. */}
            {fromEspn ? (
              <p className="mt-1 text-muted">
                Indicative lines from{" "}
                <span className="font-medium text-foreground">
                  {feed?.events.find((e) => e.source === "espn")?.bookmaker ?? "ESPN"}
                </span>{" "}
                — a single provider, not a shopped market. Always check the price at your book.
              </p>
            ) : (
              <p className="mt-1 text-muted">
                Live moneyline, spread, and total odds from the board.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/#lines"
              scroll={false}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-display text-sm font-medium",
                sport === null
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              All
            </Link>
            {availableSports.map((s) => (
              <Link
                key={s}
                href={`/?sport=${s}#lines`}
                scroll={false}
                aria-label={`Show ${SPORT_LABELS[s]} lines`}
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

        {!feed ? null : !feed.supported ? (
          <p className="text-muted">
            Live odds for {sport ? SPORT_LABELS[sport] : "these games"} aren&apos;t available.
          </p>
        ) : feed.events.length === 0 ? (
          <p className="text-muted">
            No upcoming {sport ? `${SPORT_LABELS[sport]} ` : ""}games on the board right now.
          </p>
        ) : (
          <Carousel gapClass="gap-4" fadeFromClass="from-surface" step={340}>
            {feed.events.slice(0, eventCap).map((event) => {
              const board = buildOddsBoard(event);
              const isLive = Boolean(event.liveScore) && !event.liveScore?.completed;
              const isFinal = event.liveScore?.completed;

              // Layout follows each card's own sport: fight cards are
              // moneyline-only, soccer lists the home side first.
              const moneylineOnly = isMoneylineOnly(event.sport);
              const homeFirst = event.sport === "SOCCER";

              // The two competitors, ordered per sport (home-first for soccer),
              // each carrying its own line so the rows can be reordered together.
              const away = {
                key: "away" as const,
                label: "Away",
                team: event.awayTeam,
                logo: event.awayTeamLogo,
                score: event.liveScore?.awayScore,
                spread: board.spread.away,
                moneyline: board.moneyline.away,
              };
              const home = {
                key: "home" as const,
                label: "Home",
                team: event.homeTeam,
                logo: event.homeTeamLogo,
                score: event.liveScore?.homeScore,
                spread: board.spread.home,
                moneyline: board.moneyline.home,
              };
              const sides = homeFirst ? [home, away] : [away, home];
              const league = event.sport === "SOCCER" ? soccerLeagueMeta(event.sportKey) : null;

              return (
                <div key={event.id} className="card w-80 shrink-0 snap-start p-4">
                  <div className="flex items-center justify-between text-xs">
                    {isLive ? (
                      <span className="flex items-center gap-1.5 font-semibold text-danger">
                        <span className="flex items-center gap-1">
                          <Radio className="h-3 w-3 animate-pulse" /> LIVE
                        </span>
                        {event.liveScore?.detail && (
                          <span className="font-medium text-muted">· {event.liveScore.detail}</span>
                        )}
                      </span>
                    ) : isFinal ? (
                      <span className="font-semibold text-muted">FINAL</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <LocalTime iso={event.commenceTime} />
                      </span>
                    )}

                    {/* Soccer names its competition instead of its sport: one
                        board mixes a dozen of them, and "Premier League" tells
                        you what you're looking at where "Soccer" doesn't. Shown
                        on every soccer card, not just the merged board, since
                        the soccer tab is itself a mix of leagues. */}
                    {league ? (
                      <span className="flex min-w-0 items-center gap-1 font-medium text-muted">
                        <FlagIcon code={league.code} />
                        <span className="truncate">{league.league}</span>
                      </span>
                    ) : (
                      // In the merged board, tag each card with its sport so a
                      // mixed slate stays legible at a glance.
                      mixed && (
                        <span className="flex items-center gap-1 font-medium text-muted">
                          <SportIcon sport={event.sport} className="h-3.5 w-3.5" />
                          {SPORT_LABELS[event.sport]}
                        </span>
                      )
                    )}
                  </div>

                  {moneylineOnly ? (
                    // Fight card: two fighters, moneyline only — no spread/total.
                    <div className="mt-3 flex flex-col gap-2">
                      {sides.map((s) => (
                        <div key={s.key} className="flex items-center gap-2">
                          <TeamLogo sport={event.sport} logoUrl={s.logo} className="h-7 w-7 shrink-0" />
                          <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{s.team}</p>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{cell(s.moneyline)}</span>
                        </div>
                      ))}
                      {/* Same rule as the grid below: a three-way market is
                          never shown as a two-way one. The logo column is held
                          empty so the prices stay in line. */}
                      {board.moneyline.draw && (
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 shrink-0" aria-hidden />
                          <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-muted">
                            Draw
                          </p>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {cell(board.moneyline.draw)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5">
                        {sides.map((s) => (
                          <Fragment key={s.key}>
                            <TeamLogo sport={event.sport} logoUrl={s.logo} className="h-7 w-7 shrink-0" />
                            <p className="min-w-0 truncate font-display text-sm font-semibold">{s.team}</p>
                            <p className="text-sm font-bold tabular-nums">{s.score ?? ""}</p>
                          </Fragment>
                        ))}
                      </div>

                      {event.markets.length > 0 && (
                        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1 border-t border-border pt-2 text-xs">
                          <span />
                          <span className="text-right font-medium text-muted">Spread</span>
                          <span className="text-right font-medium text-muted">Total</span>
                          <span className="text-right font-medium text-muted">ML</span>

                          {sides.map((s, i) => (
                            <Fragment key={s.key}>
                              <span className="truncate text-muted">{s.label}</span>
                              <span className="text-right">{cell(s.spread)}</span>
                              <span className="text-right">{cell(i === 0 ? board.total.over : board.total.under)}</span>
                              <span className="text-right">{cell(s.moneyline)}</span>
                            </Fragment>
                          ))}

                          {/* Soccer's third outcome. Two rows on a three-way
                              market reads as a two-way one, and the shorter
                              price looks far better than it is — the draw was
                              priced, so it is shown. Only the ML column has a
                              value: a draw has no spread and no total. */}
                          {board.moneyline.draw && (
                            <Fragment>
                              <span className="truncate text-muted">Draw</span>
                              <span className="text-right">{cell(null)}</span>
                              <span className="text-right">{cell(null)}</span>
                              <span className="text-right">{cell(board.moneyline.draw)}</span>
                            </Fragment>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Directly beneath the price grid — the link is about the
                      numbers immediately above it, so the gap stays tight.
                      Right-aligned to sit under the odds columns: full width, it
                      landed under the Away/Home labels on the opposite side of
                      the card from the prices it refers to. */}
                  {book && (
                    <div className="mt-2 flex justify-end">
                      <SportsbookCta book={book} variant="button" sport={event.sport} league={event.sportKey} event={event.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </Carousel>
        )}
      </div>
    </section>
  );
}
