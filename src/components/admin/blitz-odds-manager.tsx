"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Play, Info, AlertCircle, TrendingDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date-format";
import { fetchJson } from "@/lib/fetch-json";

interface Settings {
  enabled: boolean;
  pollMinutes: number;
  baselineFromMinutes: number;
  baselineToMinutes: number;
  alertFromMinutes: number;
  alertToMinutes: number;
  bookmakers: string;
  minProbDelta: number;
  minBooks: number;
  watchGameLines: boolean;
  watchAlternates: boolean;
  watchProps: boolean;
  watchSoccerExtras: boolean;
  dailyCreditCap: number;
  maxDeepEvents: number;
  sportKeys: string;
  notifyOnSite: boolean;
  notifyPush: boolean;
  notifyTelegram: boolean;
  telegramChatId: string;
}

interface Estimate {
  leagues: number;
  gameLineCredits: number;
  deepCredits: number;
  perRun: number;
  perDay: number;
  quietPerDay: number;
}

interface DropRow {
  id: string;
  matchup: string;
  sport: string;
  marketLabel: string;
  selection: string;
  point: number | null;
  bookCount: number;
  books: string;
  openPrice: number;
  currentPrice: number;
  probDelta: number;
  baselineMinutes: number;
  minutesToStart: number;
  notifiedAt: string | null;
  detectedAt: string;
}

interface RunRow {
  id: string;
  startedAt: string;
  credits: number;
  requests: number;
  eventsSeen: number;
  dropsFound: number;
  booksSeen: string;
  stoppedReason: string | null;
  error: string | null;
}

interface Props {
  configured: boolean;
  telegramReady: boolean;
  unverifiedMarkets: string[];
  settings: Settings;
  estimate: Estimate;
  usedToday: number;
  drops: DropRow[];
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

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0"
      />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function BlitzOddsManager({
  configured,
  telegramReady,
  unverifiedMarkets,
  settings: initial,
  estimate: initialEstimate,
  usedToday,
  drops,
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

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    const res = await fetchJson<{ estimate: Estimate }>("/api/admin/blitz-odds/settings", {
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
      dropsFound: number;
      stoppedReason: string | null;
    }>("/api/admin/blitz-odds/run", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "The cycle failed.");
      router.refresh();
      return;
    }
    const d = res.data;
    setNote(
      d
        ? `Watched ${d.eventsSeen} events for ${d.credits} credits — ${d.dropsFound} drop${
            d.dropsFound === 1 ? "" : "s"
          }.${d.stoppedReason ? ` ${d.stoppedReason}` : ""}`
        : "Cycle finished."
    );
    router.refresh();
  }

  if (!configured) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold">Blitz Odds</h1>
        <p className="mt-2 text-sm text-muted">
          Set <code>THE_ODDS_API_KEY</code> to use the watcher. It reads the same feed the board does.
        </p>
      </div>
    );
  }

  const capPct = s.dailyCreditCap > 0 ? Math.min(100, (usedToday / s.dailyCreditCap) * 100) : 0;
  const overBudget = estimate.perDay > s.dailyCreditCap;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Zap className="h-5 w-5 text-accent" /> Blitz Odds
        </h1>
        <p className="mt-1 text-sm text-muted">
          Watches for a price shortening at several sportsbooks before kickoff. Private — alerts go only to
          admins holding the Blitz Odds permission.
        </p>
      </div>

      {error && (
        <div className="card flex items-start gap-2 border-danger p-4 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {note && <div className="card border-accent p-4 text-sm">{note}</div>}

      {/* Spend — first, because it is the thing that decides whether this is
          affordable, and it should not be something you have to go looking for. */}
      <div className="card p-5">
        <h2 className="font-semibold">Spend</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold">{estimate.perRun}</p>
            <p className="text-xs text-muted">credits per cycle</p>
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
          <div>
            <p className="text-2xl font-bold">{estimate.quietPerDay.toLocaleString()}</p>
            <p className="text-xs text-muted">per quiet day</p>
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
          stops when the cap is reached.
        </p>

        {overBudget && (
          <p className="mt-3 flex items-start gap-2 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            If every watched league had a game kicking off at once, all day, that would cost{" "}
            {estimate.perDay.toLocaleString()} credits against a {s.dailyCreditCap.toLocaleString()} cap — so
            the watcher would stop part-way through. That is the worst case, not the expectation; real spend
            sits far closer to the quiet figure. Narrow the league list if you want the worst case inside the
            cap too.
          </p>
        )}

        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          &ldquo;Projected per day&rdquo; is the worst case: every league with a game inside the window on
          every cycle. Most of the day nothing is close to kickoff and the watcher spends only the{" "}
          {estimate.quietPerDay.toLocaleString()} credits it takes to refresh the fixture list — that is what
          keeps this affordable. Game lines are {estimate.gameLineCredits} per busy cycle, one bulk request per
          league however many games it holds; deep markets add {estimate.deepCredits}, because props,
          alternates, corners and cards are sold per event.
        </p>
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
          <Toggle
            label="Watcher on"
            checked={s.enabled}
            onChange={(v) => set("enabled", v)}
            hint="Off means the scheduled cycle returns immediately and spends nothing."
          />

          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Windows</legend>
            <p className="text-xs text-muted">
              A baseline price is taken {s.baselineFromMinutes}–{s.baselineToMinutes} minutes before kickoff
              and compared against the price {s.alertFromMinutes}–{s.alertToMinutes} minutes before kickoff.
              Nothing outside those two bands is ever fetched — not earlier, and not in the final{" "}
              {s.alertToMinutes} minutes — which is what keeps this cheap. The band ends at{" "}
              {s.alertToMinutes} minutes so an alert always leaves time to act on it.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Num
                label="Baseline from (min before)"
                value={s.baselineFromMinutes}
                onChange={(n) => set("baselineFromMinutes", n)}
                hint="Nothing further out than this is fetched at all — the main cost control."
              />
              <Num
                label="Baseline to (min before)"
                value={s.baselineToMinutes}
                onChange={(n) => set("baselineToMinutes", n)}
                hint="Must be greater than the alert band's start."
              />
              <Num
                label="Alert from (min before)"
                value={s.alertFromMinutes}
                onChange={(n) => set("alertFromMinutes", n)}
                hint="The earliest an alert may fire."
              />
              <Num
                label="Alert to (min before)"
                value={s.alertToMinutes}
                onChange={(n) => set("alertToMinutes", n)}
                hint="The latest. Alerts stop here, so there is still time to place the bet."
              />
            </div>
            <Num
              label="Effective poll cadence (minutes)"
              value={s.pollMinutes}
              onChange={(n) => set("pollMinutes", n)}
              hint="How often a cycle actually runs — the workflow fires every 5 minutes and polls 5 times per run, so this is 1. Used to project spend and to check the cadence against the alert band; the workflow is what actually sets it."
            />
            {s.pollMinutes * 2 > s.alertFromMinutes - s.alertToMinutes + 1 && (
              <p className="flex items-start gap-2 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The alert band is only {s.alertFromMinutes - s.alertToMinutes + 1} minutes wide, and polling
                every {s.pollMinutes} min is not frequent enough to reliably land a sample inside it — games
                will silently produce nothing. Poll at least twice as often as the band is wide.
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Num
              label="Minimum move (probability points)"
              value={s.minProbDelta}
              onChange={(n) => set("minProbDelta", n)}
              step={0.25}
              hint="Measured in implied probability, not American odds — a 20-point move means something very different at -110 than at +1000."
            />
            <Num
              label="Confirmed at (books)"
              value={s.minBooks}
              onChange={(n) => set("minBooks", n)}
              hint="One book moving is noise. Two or more moving together is a signal."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Num
              label="Daily credit cap"
              value={s.dailyCreditCap}
              onChange={(n) => set("dailyCreditCap", n)}
              hint="Hard stop. The cycle refuses a request it cannot afford."
            />
            <Num
              label="Deepen at most (games per cycle)"
              value={s.maxDeepEvents}
              onChange={(n) => set("maxDeepEvents", n)}
              hint="Soonest kickoffs first. Only applies to the deep markets below."
            />
          </div>

          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Markets</legend>
            <Toggle
              label="Game lines"
              checked={s.watchGameLines}
              onChange={(v) => set("watchGameLines", v)}
              hint="Moneyline, spread, total. One bulk request per league — cheap, and covers every game."
            />
            <Toggle
              label="Alternates and periods"
              checked={s.watchAlternates}
              onChange={(v) => set("watchAlternates", v)}
              hint="Alternate lines, team totals, halves and quarters. Per game."
            />
            <Toggle
              label="Player props"
              checked={s.watchProps}
              onChange={(v) => set("watchProps", v)}
              hint="Points, yards, strikeouts, shots and the rest. Per game, US books."
            />
            <Toggle
              label="Soccer corners and cards"
              checked={s.watchSoccerExtras}
              onChange={(v) => set("watchSoccerExtras", v)}
              hint="Per game. These market keys are documented upstream but unconfirmed against this key — see the note below."
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Alerts</legend>
            <Toggle label="On the site" checked={s.notifyOnSite} onChange={(v) => set("notifyOnSite", v)} />
            <Toggle label="Browser push" checked={s.notifyPush} onChange={(v) => set("notifyPush", v)} />
            <Toggle
              label="Telegram (private)"
              checked={s.notifyTelegram}
              onChange={(v) => set("notifyTelegram", v)}
              hint="Sent to the chat below — never to the broadcast channel."
            />
            <label className="block">
              <span className="text-sm font-medium">Private Telegram chat id</span>
              <input
                value={s.telegramChatId}
                onChange={(e) => set("telegramChatId", e.target.value)}
                placeholder="e.g. 123456789"
                className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-muted">
                Your own chat with the bot, not a channel. Message the bot once, then read the id from{" "}
                <code>getUpdates</code>. Falls back to <code>TELEGRAM_ALERT_CHAT_ID</code>.
                {s.notifyTelegram && !telegramReady && (
                  <span className="mt-1 block text-danger">
                    Telegram alerts are on but no reachable chat is configured — nothing will be sent.
                  </span>
                )}
              </span>
            </label>
          </fieldset>

          <label className="block">
            <span className="text-sm font-medium">Books</span>
            <input
              value={s.bookmakers}
              onChange={(e) => set("bookmakers", e.target.value)}
              placeholder="bet365,betano"
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-muted">
              Comma-separated feed keys. Up to ten bill as a single region, so a short list costs no less
              than a long one — but <strong>one unrecognised key rejects the entire request</strong>, which
              looks exactly like &ldquo;no games found&rdquo;. Check the Books column in Recent cycles below
              to see which actually answered.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Leagues</span>
            <input
              value={s.sportKeys}
              onChange={(e) => set("sportKeys", e.target.value)}
              placeholder="Leave empty to watch every league the board carries"
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-muted">
              Comma-separated feed keys, e.g. <code>baseball_mlb, soccer_epl</code>. Narrowing this is the
              single most effective way to cut the bill.
            </span>
          </label>
        </div>

        {unverifiedMarkets.length > 0 && (
          <p className="mt-4 flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Unconfirmed market keys: <code>{unverifiedMarkets.join(", ")}</code>. These are documented by the
            feed but have never returned data to this key. They are requested in their own batch, so a wrong key
            costs only that batch — if a market never appears in the feed below, that key is the reason.
          </p>
        )}
      </div>

      {/* Drops */}
      <div className="card p-5">
        <h2 className="font-semibold">Drops</h2>
        {drops.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing yet. A drop needs two cycles — the first records a baseline, the second measures against it.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="pb-2 pr-3 font-medium">Selection</th>
                  <th className="pb-2 pr-3 font-medium">Game</th>
                  <th className="pb-2 pr-3 font-medium">Move</th>
                  <th className="pb-2 pr-3 font-medium">Books</th>
                  <th className="pb-2 pr-3 font-medium">Window</th>
                  <th className="pb-2 font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {drops.map((d) => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">
                      <span className="font-medium">
                        {d.selection}
                        {d.point !== null && ` ${sign(d.point)}`}
                      </span>
                      <span className="block text-xs text-muted">{d.marketLabel}</span>
                    </td>
                    <td className="py-2 pr-3">
                      {d.matchup}
                      <span className="block text-xs text-muted">{d.sport}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-medium text-accent">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {sign(d.openPrice)} → {sign(d.currentPrice)}
                      </span>
                      <span className="block text-xs text-muted">+{d.probDelta.toFixed(1)} pts</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{d.bookCount}</span>
                      <span className="block max-w-[16rem] truncate text-xs text-muted">{d.books}</span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {d.baselineMinutes} → {d.minutesToStart} min
                      <span className="block text-xs text-muted">before kickoff</span>
                    </td>
                    <td className="py-2 whitespace-nowrap text-xs text-muted">
                      {formatDateTime(d.detectedAt)}
                      {!d.notifiedAt && <span className="block text-danger">not sent</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Runs */}
      <div className="card p-5">
        <h2 className="font-semibold">Recent cycles</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No cycles yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Credits</th>
                  <th className="pb-2 pr-3 font-medium">Requests</th>
                  <th className="pb-2 pr-3 font-medium">Events</th>
                  <th className="pb-2 pr-3 font-medium">Drops</th>
                  <th className="pb-2 pr-3 font-medium">Books</th>
                  <th className="pb-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-3 whitespace-nowrap text-xs">{formatDateTime(r.startedAt)}</td>
                    <td className="py-2 pr-3">{r.credits}</td>
                    <td className="py-2 pr-3">{r.requests}</td>
                    <td className="py-2 pr-3">{r.eventsSeen}</td>
                    <td className="py-2 pr-3">{r.dropsFound}</td>
                    <td className="py-2 pr-3 text-xs">
                      {r.booksSeen ? (
                        r.booksSeen
                      ) : (
                        <span className="text-muted">none</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted">
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
