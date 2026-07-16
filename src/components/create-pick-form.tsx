"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarSearch, PencilLine, Plus } from "lucide-react";
import { SPORT_LABELS, BET_TYPE_LABELS, cn, formatMatchup, usesVsSeparator } from "@/lib/utils";
import { formatOdds } from "@/lib/odds";
import { getTeamNames } from "@/lib/team-logos";
import { TeamLogo } from "@/components/team-logo";
import { TeamCrest } from "@/components/team-crest";
import { EventMarkets } from "@/components/event-markets";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";
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
  handicapperSports,
  open: openProp,
  onOpenChange,
}: {
  handicapperSports: string[];
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

  const [sport, setSport] = useState(handicapperSports[0] ?? sportKeys[0]);
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
    if (mode === "schedule") void loadFeed(sport);
  }

  function switchMode(next: "schedule" | "manual") {
    setMode(next);
    if (next === "schedule" && feed.status === "idle") void loadFeed(sport);
  }

  function changeSport(next: string) {
    setSport(next);
    if (mode === "schedule") void loadFeed(next);
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

  const readyToSubmit = mode === "manual" || (selectedEvent && selectedMarket);
  const teamNames = getTeamNames(sport as PickSport);
  const vsSport = usesVsSeparator(sport);

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-4 p-5">
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
          {sportKeys.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {mode === "schedule" ? (
        <div className="flex flex-col gap-3">
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
            <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
              {feed.events.map((event) => (
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
                      {format(new Date(event.commenceTime), "MMM d, h:mm a")}
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
              ))}
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
                <span className="tabular-nums">{formatOdds(selectedMarket.odds)}</span>
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
