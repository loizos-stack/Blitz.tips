"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Play, Save, AlertCircle, Info, ArrowUp, ArrowDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date-format";
import { fetchJson } from "@/lib/fetch-json";

interface Settings {
  enabled: boolean;
  sports: string;
  windowMinutes: number;
  clusterMinutes: number;
  minProps: number;
  minBooks: number;
  minProbDelta: number;
  countLineMoves: boolean;
  dailyCreditCap: number;
  maxEventsPerRun: number;
}

interface Estimate {
  perEvent: number;
  perRun: number;
  perDay: number;
  pollsPerDay: number;
  markets: number;
}

interface SignalRow {
  id: string;
  matchup: string;
  sportKey: string;
  player: string;
  marketCount: number;
  bookCount: number;
  books: string;
  markets: string;
  direction: string;
  topProbDelta: number;
  moves: Move[];
  minutesToStart: number;
  detectedAt: string;
  acknowledgedAt: string | null;
}

interface RunRow {
  id: string;
  startedAt: string;
  credits: number;
  requests: number;
  eventsSeen: number;
  playersSeen: number;
  signalsFound: number;
  stoppedReason: string | null;
  error: string | null;
}

interface Move {
  marketKey: string;
  selection: string;
  bookmaker: string;
  kind: "price" | "line";
  from: number;
  to: number;
  probDelta: number;
  /** Human market name, resolved on the server. */
  label: string;
}

interface Props {
  configured: boolean;
  sports: string[];
  pollMinutes: number;
  settings: Settings;
  estimate: Estimate;
  usedToday: number;
  signals: SignalRow[];
  runs: RunRow[];
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Num({
  label,
  value,
  onChange,
  hint,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function PlayerPropsManager({
  configured,
  sports,
  pollMinutes,
  settings: initial,
  estimate: initialEstimate,
  usedToday,
  signals,
  runs,
}: Props) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [estimate, setEstimate] = useState(initialEstimate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const chosen = s.sports.split(",").map((x) => x.trim()).filter(Boolean);
  const toggleSport = (sport: string) => {
    const next = chosen.includes(sport) ? chosen.filter((x) => x !== sport) : [...chosen, sport];
    set("sports", next.join(","));
  };

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await fetchJson<{ estimate: Estimate }>("/api/admin/player-props/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save.");
      return;
    }
    if (res.data?.estimate) setEstimate(res.data.estimate);
    setNote("Saved.");
    router.refresh();
  }

  async function runNow() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await fetchJson<{
      credits: number;
      eventsSeen: number;
      playersSeen: number;
      signalsFound: number;
      stoppedReason: string | null;
    }>("/api/admin/player-props/run", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "The cycle failed.");
      router.refresh();
      return;
    }
    const d = res.data;
    setNote(
      d
        ? `Watched ${d.playersSeen} player(s) across ${d.eventsSeen} game(s) for ${d.credits} credits — ${
            d.signalsFound
          } alert${d.signalsFound === 1 ? "" : "s"}.${d.stoppedReason ? ` ${d.stoppedReason}` : ""}`
        : "Cycle finished."
    );
    router.refresh();
  }

  async function acknowledge(id?: string) {
    setBusy(true);
    const res = await fetchJson("/api/admin/player-props/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Couldn't mark that as seen.");
    router.refresh();
  }

  if (!configured) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold">Player Props</h1>
        <p className="mt-2 text-sm text-muted">
          Set <code>THE_ODDS_API_KEY</code> to use this. It reads the same feed the board does, but props
          are billed per event rather than per league.
        </p>
      </div>
    );
  }

  const capPct = s.dailyCreditCap > 0 ? Math.min(100, (usedToday / s.dailyCreditCap) * 100) : 0;
  const overBudget = estimate.perDay > s.dailyCreditCap;
  const unread = signals.filter((x) => !x.acknowledgedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Activity className="h-5 w-5 text-accent" /> Player Props
        </h1>
        <p className="mt-1 text-sm text-muted">
          Alerts when several of one player&rsquo;s props move together — in either direction — at more than
          one sportsbook, inside a few minutes. One prop moving is noise; the same player&rsquo;s lines
          moving at independent books usually is not.
        </p>
      </div>

      {error && (
        <div className="card flex items-start gap-2 border-danger p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {note && <div className="card border-accent p-4 text-sm">{note}</div>}

      {/* Spend first: it is the thing that decides whether this is affordable at
          all, and it should not be something you have to go looking for. */}
      <div className="card p-5">
        <h2 className="font-semibold">Spend</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold">{estimate.perEvent}</p>
            <p className="text-xs text-muted">credits per game</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{estimate.perRun}</p>
            <p className="text-xs text-muted">per cycle, full slate</p>
          </div>
          <div>
            <p className={cn("text-2xl font-bold", overBudget && "text-danger")}>
              {estimate.perDay.toLocaleString()}
            </p>
            <p className="text-xs text-muted">projected per day</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{usedToday.toLocaleString()}</p>
            <p className="text-xs text-muted">spent today</p>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border">
          <div
            className={cn("h-full rounded-full", capPct > 90 ? "bg-danger" : "bg-accent")}
            style={{ width: `${capPct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {usedToday.toLocaleString()} of {s.dailyCreditCap.toLocaleString()} credits used today. The cycle
          checks the cap before each game and stops when it is reached.
        </p>

        {overBudget && (
          <p className="mt-3 flex items-start gap-2 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              A full slate every cycle, all day, would cost {estimate.perDay.toLocaleString()} against a{" "}
              {s.dailyCreditCap.toLocaleString()} cap — so the watcher would stop part-way through the day.
              Lower the games per cycle, narrow the window, or raise the cap deliberately.
            </span>
          </p>
        )}

        {/* The text lives in its own span: this is a flex row, and without it
            every inline <code> and <em> becomes a flex item and is laid out as
            a box rather than flowing with the sentence. */}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Props are billed per game, not per league: {estimate.markets} markets × 1 region ={" "}
            {estimate.perEvent} credits every time a game is read, however recently it was last read. The
            projection assumes {estimate.pollsPerDay} cycles a day, which is the {pollMinutes}-minute
            schedule in <code>vercel.json</code> — if that schedule is not actually running, the real figure
            is lower and so is the tool&rsquo;s usefulness. Working out <em>which</em> games to read is free.
          </span>
        </p>
      </div>

      {/* Alerts — the reason the tool exists. */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            Alerts{unread > 0 && <span className="ml-2 text-sm font-normal text-danger">{unread} new</span>}
          </h2>
          {unread > 0 && (
            <button
              onClick={() => acknowledge()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> Mark all seen
            </button>
          )}
        </div>

        {signals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing yet. An alert needs {s.minProps} of a player&rsquo;s props to move at {s.minBooks} books
            inside {s.clusterMinutes} minutes.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {signals.map((signal) => {
              const moves = signal.moves;
              const down = signal.direction === "DOWN";
              const mixed = signal.direction === "MIXED";
              return (
                <div
                  key={signal.id}
                  className={cn(
                    "rounded-lg border p-4",
                    signal.acknowledgedAt ? "border-border opacity-70" : "border-accent"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-display font-semibold">
                        {!mixed &&
                          (down ? (
                            <ArrowDown className="h-4 w-4 text-danger" />
                          ) : (
                            <ArrowUp className="h-4 w-4 text-accent" />
                          ))}
                        {signal.player}
                      </p>
                      <p className="text-xs text-muted">
                        {signal.matchup} · {signal.minutesToStart} min to kickoff
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {signal.marketCount} props · {signal.bookCount} books
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(new Date(signal.detectedAt))}</p>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-xs">
                    {moves.map((m, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-muted">{m.selection}</span>
                        <span className="text-muted">@ {m.bookmaker}</span>
                        <span className="tabular-nums">
                          {m.kind === "line"
                            ? `line ${m.from} → ${m.to}`
                            : `${sign(m.from)} → ${sign(m.to)}`}
                        </span>
                        {m.probDelta !== 0 && (
                          <span className={cn("tabular-nums", m.probDelta > 0 ? "text-accent" : "text-danger")}>
                            {sign(Number(m.probDelta.toFixed(2)))} pts
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {!signal.acknowledgedAt && (
                    <button
                      onClick={() => acknowledge(signal.id)}
                      disabled={busy}
                      className="mt-3 text-xs font-medium text-accent hover:underline disabled:opacity-60"
                    >
                      Mark seen
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Settings</h2>
          <div className="flex gap-2">
            <button
              onClick={runNow}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent disabled:opacity-60"
            >
              <Play className="h-4 w-4" /> Run one cycle
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>
              <span className="text-sm font-medium">Watcher on</span>
              <span className="mt-0.5 block text-xs text-muted">
                Off means the scheduled cycle returns immediately and spends nothing.
              </span>
            </span>
          </label>

          <div>
            <span className="text-sm font-medium">Sports</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {sports.map((sport) => {
                const on = chosen.length === 0 || chosen.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"
                    )}
                  >
                    {sport}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-xs text-muted">
              These are the sports that carry player props. Nothing selected means all of them — which is
              also the most expensive setting, since a busy evening across every league fills the game
              budget with whatever kicks off soonest.
            </span>
          </div>

          <fieldset className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">What counts as a signal</legend>
            <Num
              label="Props that must move"
              value={s.minProps}
              onChange={(v) => set("minProps", v)}
              hint="Distinct markets of the same player. Two is the point of the tool."
            />
            <Num
              label="Books that must agree"
              value={s.minBooks}
              onChange={(v) => set("minBooks", v)}
              hint="One book repricing a player happens all day and means little."
            />
            <Num
              label="Within (minutes)"
              value={s.clusterMinutes}
              onChange={(v) => set("clusterMinutes", v)}
              hint="Moves further apart than this are not the same event."
            />
            <Num
              label="Minimum move (prob. points)"
              value={s.minProbDelta}
              onChange={(v) => set("minProbDelta", v)}
              step={0.5}
              hint="Measured in implied probability, so it means the same at -110 and +1000."
            />
            <label className="flex items-start gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={s.countLineMoves}
                onChange={(e) => set("countLineMoves", e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                <span className="text-sm font-medium">Count line moves</span>
                <span className="mt-0.5 block text-xs text-muted">
                  A line moving from 25.5 to 23.5 at an unchanged price is a move — often the clearest one.
                  No probability change is reported for these, because prices at two different lines are
                  not comparable.
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
            <legend className="px-1 text-sm font-semibold">Reach and budget</legend>
            <Num
              label="Look ahead (minutes)"
              value={s.windowMinutes}
              onChange={(v) => set("windowMinutes", v)}
              hint="Only games kicking off within this are read."
            />
            <Num
              label="Games per cycle"
              value={s.maxEventsPerRun}
              onChange={(v) => set("maxEventsPerRun", v)}
              hint="Soonest kickoff first. This multiplies the bill directly."
            />
            <Num
              label="Daily credit cap"
              value={s.dailyCreditCap}
              onChange={(v) => set("dailyCreditCap", v)}
              hint="Checked before each game against that game's own price."
            />
          </fieldset>
        </div>
      </div>

      {/* Run log — tells a quiet slate from a broken feed. */}
      <div className="card p-5">
        <h2 className="font-semibold">Recent cycles</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing has run yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2">Started</th>
                  <th>Credits</th>
                  <th>Games</th>
                  <th>Players</th>
                  <th>Alerts</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 whitespace-nowrap">{formatDateTime(new Date(r.startedAt))}</td>
                    <td className="tabular-nums">{r.credits}</td>
                    <td className="tabular-nums">{r.eventsSeen}</td>
                    <td className="tabular-nums">{r.playersSeen}</td>
                    <td className="tabular-nums">{r.signalsFound}</td>
                    <td className="text-xs text-muted">
                      {r.error ? <span className="text-danger">{r.error}</span> : r.stoppedReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
