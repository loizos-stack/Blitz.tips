"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { SPORT_LABELS } from "@/lib/utils";
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
 * Pick entry for a contest entrant. Every pick is taken off our live board —
 * there is no manual entry and no odds field, so an entrant can never supply
 * their own price. They choose a game and a line from the full market navigator
 * (moneylines, spreads/handicaps, totals, alternate lines, 1st half / quarter /
 * period markets, player props) and set only their stake. The server re-verifies
 * the line against the feed before storing it. Singles only — no parlays.
 */
export function ContestPickForm({ contestId }: { contestId: string }) {
  const router = useRouter();
  const [sport, setSport] = useState("");
  const [feed, setFeed] = useState<FeedState>({ status: "idle" });
  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketOption | null>(null);

  const [units, setUnits] = useState("1");
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
    if (next) void loadFeed(next);
    else setFeed({ status: "idle" });
  }

  function chooseMarket(event: UpcomingEvent, market: MarketOption) {
    setSelectedEvent(event);
    setSelectedMarket(market);
  }

  function reset() {
    setSelectedEvent(null);
    setSelectedMarket(null);
    setUnits("1");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedEvent || !selectedMarket) {
      setError("Pick a line from a game above.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/supercapper/${contestId}/picks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport,
        oddsApiEventId: selectedEvent.id,
        selection: selectedMarket.selection,
        odds: selectedMarket.odds,
        units: Number(units),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not submit pick");
      // A moved line (409) means the board is stale — reload it.
      if (res.status === 409 && sport) void loadFeed(sport);
      return;
    }
    reset();
    if (sport) void loadFeed(sport);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
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

      {feed.status === "loading" && <p className="text-xs text-muted">Loading games…</p>}
          {feed.status === "unavailable" && (
            <p className="rounded-lg border border-border bg-surface-raised p-2.5 text-xs text-muted">
              {feed.reason}.
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
