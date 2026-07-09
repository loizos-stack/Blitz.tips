"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarSearch, PencilLine, ImageUp, Trash2, Layers } from "lucide-react";
import { SPORT_LABELS, cn } from "@/lib/utils";
import { formatOdds, combineParlayOdds } from "@/lib/odds";
import type { MarketOption, UpcomingEvent } from "@/lib/odds-api";

const sportKeys = Object.keys(SPORT_LABELS);

interface Leg {
  matchup: string;
  selection: string;
  odds: number;
}

type FeedState =
  | { status: "idle" | "loading" }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; events: UpcomingEvent[] };

export function CreateParlayForm({ handicapperSports }: { handicapperSports: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "schedule" | "upload">("manual");

  const [sport, setSport] = useState(handicapperSports[0] ?? sportKeys[0]);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [units, setUnits] = useState("1");
  const [analysis, setAnalysis] = useState("");
  const [isPremium, setIsPremium] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Manual leg inputs
  const [mMatchup, setMMatchup] = useState("");
  const [mSelection, setMSelection] = useState("");
  const [mOdds, setMOdds] = useState("-110");

  // Schedule feed
  const [feed, setFeed] = useState<FeedState>({ status: "idle" });
  const [feedSport, setFeedSport] = useState(handicapperSports[0] ?? sportKeys[0]);
  const [openEvent, setOpenEvent] = useState<string | null>(null);

  // Upload
  const [ocrBusy, setOcrBusy] = useState(false);

  const combined = legs.length >= 2 ? combineParlayOdds(legs.map((l) => l.odds)) : null;
  const input =
    "rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  const addLeg = (leg: Leg) => setLegs((prev) => [...prev, leg]);
  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, idx) => idx !== i));

  const loadFeed = useCallback(async (forSport: string) => {
    setFeed({ status: "loading" });
    const res = await fetch(`/api/odds/events?sport=${forSport}`).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !body) return setFeed({ status: "unavailable", reason: "Could not load the schedule" });
    if (!body.configured) return setFeed({ status: "unavailable", reason: "Live odds aren't configured on this server" });
    if (!body.supported) return setFeed({ status: "unavailable", reason: `${SPORT_LABELS[forSport]} isn't covered by the feed` });
    if (!body.events?.length) return setFeed({ status: "unavailable", reason: "No upcoming games for this sport right now" });
    setFeed({ status: "ready", events: body.events });
  }, []);

  function addManualLeg() {
    const odds = Number(mOdds);
    if (!mMatchup.trim() || !mSelection.trim() || !Number.isInteger(odds) || odds === 0) {
      setError("Enter a matchup, selection, and valid odds for the leg");
      return;
    }
    setError(null);
    addLeg({ matchup: mMatchup.trim(), selection: mSelection.trim(), odds });
    setMMatchup("");
    setMSelection("");
    setMOdds("-110");
  }

  function addScheduleLeg(event: UpcomingEvent, market: MarketOption) {
    addLeg({ matchup: event.matchup, selection: market.selection, odds: market.odds });
    if (!eventStartsAt) {
      // Prefill the parlay start with the earliest chosen game.
      setEventStartsAt(format(new Date(event.commenceTime), "yyyy-MM-dd'T'HH:mm"));
    }
  }

  async function handleUpload(file: File) {
    setOcrBusy(true);
    setError(null);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the file"));
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) {
      setOcrBusy(false);
      setError("Could not read that file");
      return;
    }
    const res = await fetch("/api/handicapper/parlay-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    const body = await res.json().catch(() => ({}));
    setOcrBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't read the bet slip");
      return;
    }
    if (!body.legs?.length) {
      setError("No legs found in that image — try a clearer photo or add them manually");
      return;
    }
    setLegs((prev) => [...prev, ...body.legs]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (legs.length < 2) return setError("Add at least 2 legs");
    if (!eventStartsAt) return setError("Set when the first game starts");
    setLoading(true);
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sport,
        units: Number(units),
        analysis: analysis || undefined,
        isPremium,
        eventStartsAt: new Date(eventStartsAt).toISOString(),
        legs,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not post parlay");
      return;
    }
    setLegs([]);
    setAnalysis("");
    setEventStartsAt("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-semibold hover:border-accent"
      >
        <Layers className="h-4 w-4" /> Post a parlay
      </button>
    );
  }

  const tab = (key: typeof addMode, label: string, Icon: typeof PencilLine) => (
    <button
      type="button"
      onClick={() => {
        setAddMode(key);
        if (key === "schedule" && feed.status === "idle") void loadFeed(feedSport);
      }}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium",
        addMode === key ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <Layers className="h-4 w-4 text-accent" /> Build a parlay
        </p>
        {combined !== null && (
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold tabular-nums text-accent">
            {formatOdds(combined)}
          </span>
        )}
      </div>

      {/* Current legs */}
      {legs.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {legs.map((leg, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{leg.selection}</span>
                <span className="block truncate text-xs text-muted">{leg.matchup}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-muted">{formatOdds(leg.odds)}</span>
                <button type="button" onClick={() => removeLeg(i)} aria-label="Remove leg" className="text-muted hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
          No legs yet — add at least 2 below.
        </p>
      )}

      {/* Add-leg method tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-raised p-1">
        {tab("manual", "Manual", PencilLine)}
        {tab("schedule", "Schedule", CalendarSearch)}
        {tab("upload", "Upload slip", ImageUp)}
      </div>

      {addMode === "manual" && (
        <div className="flex flex-col gap-2">
          <input value={mMatchup} onChange={(e) => setMMatchup(e.target.value)} placeholder="Matchup (Chiefs @ Bills)" className={input} />
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input value={mSelection} onChange={(e) => setMSelection(e.target.value)} placeholder="Selection (Bills -2.5)" className={input} />
            <input value={mOdds} onChange={(e) => setMOdds(e.target.value)} type="number" placeholder="-110" className={input} />
          </div>
          <button type="button" onClick={addManualLeg} className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent">
            + Add leg
          </button>
        </div>
      )}

      {addMode === "schedule" && (
        <div className="flex flex-col gap-2">
          <select
            value={feedSport}
            onChange={(e) => {
              setFeedSport(e.target.value);
              void loadFeed(e.target.value);
            }}
            className={input}
          >
            {sportKeys.map((s) => (
              <option key={s} value={s}>{SPORT_LABELS[s]}</option>
            ))}
          </select>
          {feed.status === "loading" && <p className="text-sm text-muted">Loading games…</p>}
          {feed.status === "unavailable" && <p className="text-sm text-muted">{feed.reason}.</p>}
          {feed.status === "ready" && (
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {feed.events.map((event) => (
                <div key={event.id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenEvent(openEvent === event.id ? null : event.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                  >
                    <span className="font-medium">{event.matchup}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted">{format(new Date(event.commenceTime), "MMM d, h:mm a")}</span>
                  </button>
                  {openEvent === event.id && (
                    <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
                      {event.markets.length === 0 ? (
                        <p className="text-sm text-muted">No odds posted yet.</p>
                      ) : (
                        event.markets.map((market, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => addScheduleLeg(event, market)}
                            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium tabular-nums text-muted hover:border-accent hover:text-accent"
                          >
                            {market.selection} {formatOdds(market.odds)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {addMode === "upload" && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm">
          <ImageUp className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-2 text-muted">Upload a screenshot or photo of your sportsbook parlay slip.</p>
          <label className="mt-3 inline-block cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90">
            {ocrBusy ? "Reading…" : "Choose image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={ocrBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-2 text-xs text-muted">We read the teams and odds and add them as legs — review before posting.</p>
        </div>
      )}

      {/* Parlay-wide fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted">Sport tag</label>
          <select value={sport} onChange={(e) => setSport(e.target.value)} className={`${input} mt-1 w-full`}>
            {sportKeys.map((s) => (
              <option key={s} value={s}>{SPORT_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">First game starts</label>
          <input type="datetime-local" value={eventStartsAt} onChange={(e) => setEventStartsAt(e.target.value)} className={`${input} mt-1 w-full`} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Units</label>
        <input type="number" step="0.1" min="0.1" max="20" value={units} onChange={(e) => setUnits(e.target.value)} className={`${input} mt-1 w-full`} />
      </div>

      <div>
        <label className="text-xs font-medium text-muted">Analysis (optional)</label>
        <textarea value={analysis} onChange={(e) => setAnalysis(e.target.value)} rows={2} className={`${input} mt-1 w-full`} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
        Premium pick (locked for non-subscribers)
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || legs.length < 2}
          className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Posting…" : `Post ${legs.length}-leg parlay`}
        </button>
      </div>
    </form>
  );
}
