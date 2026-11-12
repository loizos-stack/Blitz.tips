"use client";

import { LocalTime } from "@/components/local-time";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { CalendarSearch, PencilLine, Plus, X } from "lucide-react";
import { SPORT_LABELS, BET_TYPE_LABELS, cn, formatMatchup, usesVsSeparator } from "@/lib/utils";
import { Odds } from "@/components/odds-format";
import { getTeamNames } from "@/lib/team-logos";
import { TeamLogo } from "@/components/team-logo";
import { TeamCrest } from "@/components/team-crest";
import { EventMarkets } from "@/components/event-markets";
import { SoccerLeagueSections } from "@/components/soccer-league-sections";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";
import { findBoardMatch } from "@/lib/board-match";
import type { PickSport } from "@prisma/client";

const sportKeys = Object.keys(SPORT_LABELS);
const betTypeKeys = Object.keys(BET_TYPE_LABELS);

type FeedState =
  | { status: "idle" | "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; events: UpcomingEvent[] };

interface FeedResponse {
  configured?: boolean;
  supported?: boolean;
  events?: UpcomingEvent[];
  error?: string;
}

export function CreatePickForm({
  open: openProp,
  onOpenChange,
}: {
  // Optional controlled open state so a parent can make the pick and parlay
  // forms mutually exclusive; falls back to internal state when omitted.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (value: boolean) => {
    setOpenState(value);
    onOpenChange?.(value);
  };
  const [mode, setMode] = useState<"schedule" | "manual">("schedule");

  // Sport starts unset so the handicapper picks one before any matches load
  // (no sport is opened by default).
  const [sport, setSport] = useState("");
  const [feed, setFeed] = useState<FeedState>({ status: "idle" });
  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketOption | null>(null);

  const [league, setLeague] = useState("");
  // Schedule mode fills `matchup` directly from the chosen event; manual mode
  // builds it from the away/home fields via formatMatchup on submit.
  const [matchup, setMatchup] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeTeam, setHomeTeam] = useState("");
  const [betType, setBetType] = useState(betTypeKeys[0]);
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("-110");
  const [units, setUnits] = useState("1");
  const [analysis, setAnalysis] = useState("");
  const [isPremium, setIsPremium] = useState(true);
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFeed = useCallback(async (forSport: string) => {
    setFeed({ status: "loading" });
    setSelectedEvent(null);
    setSelectedMarket(null);

    const res = await fetch(`/api/odds/events?sport=${forSport}`).catch(() => null);
    const body: FeedResponse | null = res ? await res.json().catch(() => null) : null;

    if (!res?.ok || !body) {
      setFeed({ status: "unavailable", reason: body?.error ?? "Could not load the schedule" });
      return;
    }
    if (!body.configured) {
      setFeed({ status: "unavailable", reason: "Live odds are not configured on this server" });
      return;
    }
    if (!body.supported) {
      setFeed({ status: "unavailable", reason: `${SPORT_LABELS[forSport]} isn't covered by the odds feed` });
      return;
    }
    if (!body.events || body.events.length === 0) {
      setFeed({ status: "unavailable", reason: "No upcoming games found for this sport right now" });
      return;
    }
    setFeed({ status: "ready", events: body.events });
  }, []);

  function openForm() {
    setOpen(true);
    // No sport is loaded by default — the handicapper picks one first.
  }

  function switchMode(next: "schedule" | "manual") {
    setMode(next);
    // The board is loaded in manual mode too. Nothing renders it there — it is
    // there so the form can notice that the game being typed by hand is
    // already on the board and say so.
    if (sport && feed.status === "idle") void loadFeed(sport);
  }

  function changeSport(next: string) {
    setSport(next);
    setSelectedEvent(null);
    setSelectedMarket(null);
    if (next) void loadFeed(next);
    else setFeed({ status: "idle" });
  }

  /**
   * Move a hand-typed game onto its board fixture, markets open.
   *
   * Not named useSomething: the `use` prefix makes ESLint read it as a React
   * hook and reject the call inside the button handler.
   */
  function switchToBoardEvent(event: UpcomingEvent) {
    setMode("schedule");
    setSelectedEvent(event);
    setSelectedMarket(null);
    setAwayTeam("");
    setHomeTeam("");
  }

  function chooseMarket(event: UpcomingEvent, market: MarketOption) {
    setSelectedEvent(event);
    setSelectedMarket(market);
    setMatchup(event.matchup);
    setBetType(market.betType);
    setSelection(market.selection);
    setOdds(String(market.odds));
    setEventStartsAt(event.commenceTime);
    setLeague("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const startsAt =
      mode === "schedule" && selectedEvent
        ? selectedEvent.commenceTime
        : new Date(eventStartsAt).toISOString();

    // Schedule mode already has a formatted matchup; manual mode assembles it
    // from the away/home fields using the sport's separator convention.
    const finalMatchup =
      mode === "schedule" ? matchup : formatMatchup(sport, awayTeam.trim(), homeTeam.trim());

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport,
        league: league || undefined,
        matchup: finalMatchup,
        betType,
        selection,
        odds: Number(odds),
        units: Number(units),
        analysis: analysis || undefined,
        isPremium,
        eventStartsAt: startsAt,
        // Schedule picks carry the odds-API event so results can be graded
        // automatically from final scores.
        oddsApiEventId: mode === "schedule" && selectedEvent ? selectedEvent.id : undefined,
        oddsApiSportKey: mode === "schedule" && selectedEvent ? selectedEvent.sportKey : undefined,
        // Structured line from the board — lets the settler grade period markets
        // and player props without parsing the selection text. Absent for
        // manually-entered picks, which grade from the text as before.
        marketKey: mode === "schedule" ? selectedMarket?.marketKey : undefined,
        side: mode === "schedule" ? selectedMarket?.side : undefined,
        linePoint: mode === "schedule" ? selectedMarket?.point : undefined,
        playerName: mode === "schedule" ? selectedMarket?.player : undefined,
      }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not create pick");
      return;
    }

    setMatchup("");
    setAwayTeam("");
    setHomeTeam("");
    setSelection("");
    setAnalysis("");
    setEventStartsAt("");
    setSelectedEvent(null);
    setSelectedMarket(null);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={openForm}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        Post a new tip <Plus className="h-4 w-4" />
      </button>
    );
  }

  const readyToSubmit = Boolean(sport) && (mode === "manual" || (selectedEvent && selectedMarket));
  const teamNames = getTeamNames(sport as PickSport);
  const vsSport = usesVsSeparator(sport);

  // The board fixture matching what is being typed by hand, if there is one.
  // A manual pick carries no event id, so the settler has to grade it from the
  // selection text — which is where wrong and ungraded results come from. Most
  // of the time the game was on the board and nobody looked.
  const boardMatch =
    mode === "manual" && feed.status === "ready"
      ? findBoardMatch(feed.events, awayTeam, homeTeam)
      : null;

  // One game row. Rendered flat for single-league sports and inside the
  // country → league headings for soccer, so it lives here rather than inline.
  function renderEvent(event: UpcomingEvent) {
    return (
      <div key={event.id} className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => {
            setSelectedEvent(selectedEvent?.id === event.id ? null : event);
            setSelectedMarket(null);
          }}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
        >
          <span className="flex min-w-0 items-center gap-2">
            {(event.awayTeamLogo || event.homeTeamLogo) && (
              <span className="flex shrink-0 items-center -space-x-1.5">
                {[
                  vsSport ? event.homeTeamLogo : event.awayTeamLogo,
                  vsSport ? event.awayTeamLogo : event.homeTeamLogo,
                ].map(
                  (logo, idx) =>
                    logo && (
                      <TeamLogo
                        key={idx}
                        sport={sport as PickSport}
                        logoUrl={logo}
                        className="h-5 w-5 rounded-full ring-2 ring-surface"
                      />
                    )
                )}
              </span>
            )}
            <span className="truncate font-display font-medium">{event.matchup}</span>
          </span>
          <span className="ml-2 shrink-0 text-xs text-muted">
            <LocalTime iso={event.commenceTime} withZone />
          </span>
        </button>

        {selectedEvent?.id === event.id && (
          <div className="border-t border-border p-3">
            <EventMarkets
              key={event.id}
              sport={sport}
              event={event}
              selected={selectedMarket}
              onSelect={(market) => chooseMarket(event, market)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <PencilLine className="h-4 w-4 text-accent" /> Post a tip
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-full p-1 text-muted hover:bg-surface-raised hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-raised p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => switchMode("schedule")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5",
            mode === "schedule" ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"
          )}
        >
          <CalendarSearch className="h-4 w-4" /> From schedule
        </button>
        <button
          type="button"
          onClick={() => switchMode("manual")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md py-1.5",
            mode === "manual" ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"
          )}
        >
          <PencilLine className="h-4 w-4" /> Manual
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Sport</label>
        <select
          value={sport}
          onChange={(e) => changeSport(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Select a sport…</option>
          {sportKeys.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {mode === "schedule" ? (
        <div className="flex flex-col gap-3">
          {!sport && (
            <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted">
              Pick a sport to load its games.
            </p>
          )}
          {feed.status === "loading" && <p className="text-sm text-muted">Loading upcoming games…</p>}

          {feed.status === "unavailable" && (
            <div className="rounded-lg border border-border bg-surface-raised p-3 text-sm text-muted">
              {feed.reason}.{" "}
              <button type="button" onClick={() => setMode("manual")} className="font-medium text-accent hover:underline">
                Enter the pick manually
              </button>
            </div>
          )}

          {feed.status === "ready" && (
            <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
              {sport === "SOCCER" ? (
                <SoccerLeagueSections events={feed.events} renderEvent={renderEvent} />
              ) : (
                feed.events.map((event) => renderEvent(event))
              )}
            </div>
          )}

          {selectedEvent && selectedMarket && (
            <div className="rounded-lg bg-surface-raised p-3 text-sm">
              <div className="flex items-center gap-2">
                <TeamLogo sport={sport as PickSport} logoUrl={vsSport ? selectedEvent.homeTeamLogo : selectedEvent.awayTeamLogo} className="h-5 w-5 shrink-0 rounded-full" />
                <p className="font-display font-semibold">{selectedEvent.matchup}</p>
                <TeamLogo sport={sport as PickSport} logoUrl={vsSport ? selectedEvent.awayTeamLogo : selectedEvent.homeTeamLogo} className="h-5 w-5 shrink-0 rounded-full" />
              </div>
              <p className="mt-0.5 text-muted">
                {BET_TYPE_LABELS[selectedMarket.betType]} · {selectedMarket.selection} ·{" "}
                <span className="tabular-nums"><Odds value={selectedMarket.odds} /></span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-medium text-muted">League (optional)</label>
            <input
              value={league}
              onChange={(e) => setLeague(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted">Matchup</label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <input
                required
                value={awayTeam}
                onChange={(e) => setAwayTeam(e.target.value)}
                placeholder={vsSport ? "Away team" : "Away team (e.g. Chiefs)"}
                list="team-suggestions"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                required
                value={homeTeam}
                onChange={(e) => setHomeTeam(e.target.value)}
                placeholder={vsSport ? "Home team" : "Home team (e.g. Bills)"}
                list="team-suggestions"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            {awayTeam.trim() && homeTeam.trim() ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                <span>Reads as</span>
                <TeamCrest sport={sport} name={vsSport ? homeTeam : awayTeam} className="h-4 w-4 shrink-0 rounded-full" />
                <span className="font-medium text-foreground">
                  {formatMatchup(sport, awayTeam.trim(), homeTeam.trim())}
                </span>
                <TeamCrest sport={sport} name={vsSport ? awayTeam : homeTeam} className="h-4 w-4 shrink-0 rounded-full" />
              </div>
            ) : (
              teamNames.length > 0 && (
                <p className="mt-1 text-[11px] text-muted">
                  Start typing to autocomplete — {vsSport ? "shown as “Home vs Away”" : "matching teams get their logo on the pick"}.
                </p>
              )
            )}

            {/* The whole point of the manual/board distinction, said at the
                only moment it can still be acted on. A pick posted off the
                board grades itself against the real score; one typed by hand
                is graded from its own wording, which is where wrong results
                come from. Worth interrupting for. */}
            {boardMatch && (
              <div className="mt-2 rounded-lg border border-accent/50 bg-accent/10 p-3">
                <p className="text-sm font-semibold">This game is on the board</p>
                <p className="mt-0.5 text-xs text-muted">
                  {boardMatch.event.matchup}
                  {boardMatch.reversed && " — the board has the teams the other way round"}.
                  Posting it from there locks in the real line and start time, and it grades
                  itself when the game ends.
                </p>
                <button
                  type="button"
                  onClick={() => switchToBoardEvent(boardMatch.event)}
                  className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
                >
                  Use the board version
                </button>
              </div>
            )}
          </div>
          <datalist id="team-suggestions">
            {teamNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted">Bet type</label>
              <select
                value={betType}
                onChange={(e) => setBetType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              >
                {betTypeKeys.map((b) => (
                  <option key={b} value={b}>
                    {BET_TYPE_LABELS[b]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Selection</label>
              <input
                required
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                placeholder="e.g. Bills -2.5, Over 44.5"
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted">Odds</label>
              <input
                required
                type="number"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Event starts</label>
              <input
                required
                type="datetime-local"
                value={eventStartsAt}
                onChange={(e) => setEventStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Units</label>
          <input
            required
            type="number"
            step="0.1"
            min="0.1"
            max="20"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        {mode === "schedule" && (
          <div>
            <label className="text-xs font-medium text-muted">Odds (editable)</label>
            <input
              required
              type="number"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Analysis (optional)</label>
        <textarea
          value={analysis}
          onChange={(e) => setAnalysis(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
        Premium pick (locked for non-subscribers)
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !readyToSubmit}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Posting…" : "Post tip"}
        </button>
      </div>
    </form>
  );
}
