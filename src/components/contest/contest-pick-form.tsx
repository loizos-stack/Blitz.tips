"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { formatOdds } from "@/lib/odds";
import { EventMarkets } from "@/components/event-markets";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";

const sportKeys = Object.keys(SPORT_LABELS);
const input =
  "mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

interface FeedResponse {
  configured?: boolean;
  supported?: boolean;
  events?: UpcomingEvent[];
  error?: string;
}
type FeedState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; events: UpcomingEvent[] };

/**
 * Pick entry for a contest entrant. Picks come off the live board — the same
 * feed and full market navigator the handicapper form uses, so everything we
 * carry is available: moneylines, spreads/handicaps, totals, alternate lines,
 * halves/quarters/periods, and player props. Manual entry stays as a fallback
 * for anything the feed doesn't price. Singles only — no parlays.
 */
export function ContestPickForm({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"schedule" | "manual">("schedule");

  const [sport, setSport] = useState("");
  const [feed, setFeed] = useState<FeedState>({ status: "idle" });
  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketOption | null>(null);

  const [matchup, setMatchup] = useState("");
  const [selection, setSelection] = useState("");
  const [odds, setOdds] = useState("-110");
  const [units, setUnits] = useState("1");
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
    if (!body.events?.length) {
      setFeed({ status: "unavailable", reason: "No upcoming games found for this sport right now" });
      return;
    }
    setFeed({ status: "ready", events: body.events });
  }, []);

  function changeSport(next: string) {
    setSport(next);
    setSelectedEvent(null);
    setSelectedMarket(null);
    setSelection("");
    if (mode === "schedule" && next) void loadFeed(next);
    else if (!next) setFeed({ status: "idle" });
  }

  function switchMode(next: "schedule" | "manual") {
    setMode(next);
    if (next === "schedule" && sport && feed.status === "idle") void loadFeed(sport);
  }

  function chooseMarket(event: UpcomingEvent, market: MarketOption) {
    setSelectedEvent(event);
    setSelectedMarket(market);
    setMatchup(event.matchup);
    setSelection(market.selection);
    setOdds(String(market.odds));
    setEventStartsAt(event.commenceTime);
  }

  function reset() {
    setSelectedEvent(null);
    setSelectedMarket(null);
    setMatchup("");
    setSelection("");
    setOdds("-110");
    setUnits("1");
    setEventStartsAt("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "schedule" && !selectedMarket) {
      setError("Pick a market from a game above.");
      return;
    }

    const startsAt =
      mode === "schedule" && selectedEvent
        ? selectedEvent.commenceTime
        : eventStartsAt
          ? new Date(eventStartsAt).toISOString()
          : "";

    setLoading(true);
    const res = await fetch(`/api/supercapper/${contestId}/picks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport,
        matchup: mode === "schedule" && selectedEvent ? selectedEvent.matchup : matchup,
        selection,
        odds: Number(odds),
        units: Number(units),
        eventStartsAt: startsAt,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not submit pick");
      return;
    }
    reset();
    if (mode === "schedule" && sport) void loadFeed(sport);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {/* Board vs manual entry */}
      <div className="flex gap-1.5">
        {(["schedule", "manual"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              mode === m
                ? "bg-accent text-accent-foreground"
                : "border border-border text-muted hover:border-muted hover:text-foreground"
            )}
          >
            {m === "schedule" ? "From the board" : "Manual"}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Sport</label>
        <select value={sport} onChange={(e) => changeSport(e.target.value)} required className={input}>
          <option value="">Select…</option>
          {sportKeys.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {mode === "schedule" ? (
        <>
          {feed.status === "loading" && <p className="text-xs text-muted">Loading games…</p>}
          {feed.status === "unavailable" && (
            <p className="rounded-lg border border-border bg-surface-raised p-2.5 text-xs text-muted">
              {feed.reason}. Try{" "}
              <button
                type="button"
                onClick={() => switchMode("manual")}
                className="font-semibold text-accent hover:underline"
              >
                manual entry
              </button>
              .
            </p>
          )}

          {feed.status === "ready" && (
            <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
              {feed.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEvent(selectedEvent?.id === event.id ? null : event);
                      setSelectedMarket(null);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
                  >
                    <span className="truncate font-display font-medium">{event.matchup}</span>
                    <span className="shrink-0 text-xs text-muted">
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

          {selectedMarket && (
            <div className="rounded-lg bg-surface-raised p-3 text-sm">
              <p className="font-display font-semibold">{selectedEvent?.matchup}</p>
              <p className="mt-0.5 text-xs text-muted">
                {selectedMarket.selection} · {formatOdds(selectedMarket.odds)}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <label className="text-xs font-medium text-muted">Matchup</label>
            <input
              required
              value={matchup}
              onChange={(e) => setMatchup(e.target.value)}
              placeholder="e.g. Chiefs @ Bills"
              className={input}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Selection</label>
            <input
              required
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              placeholder="e.g. Bills -2.5, Over 44.5"
              className={input}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Event starts</label>
            <input
              type="datetime-local"
              required
              value={eventStartsAt}
              onChange={(e) => setEventStartsAt(e.target.value)}
              className={input}
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Odds (American)</label>
          <input
            required
            type="number"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            readOnly={mode === "schedule" && Boolean(selectedMarket)}
            className={input}
          />
        </div>
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
            className={input}
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" /> {loading ? "Submitting…" : "Submit pick"}
      </button>
    </form>
  );
}
