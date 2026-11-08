"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard } from "lucide-react";

export type RecapCandidate = { handle: string; displayName: string; settled: number };

/**
 * Make a recap video on demand.
 *
 * Recaps used to render themselves overnight. They don't any more, so this is
 * the thing that asks for one: pick a day (or a span, for a winners reel),
 * optionally narrow it to particular handicappers, and start the render.
 *
 * The render runs on a GitHub Actions runner and takes a couple of minutes,
 * so there is nothing to show when the button returns — the card says what was
 * started and where it will appear rather than pretending to have a video.
 */
export function RecapBuilder({
  /** Handicappers with at least one settled pick, most active first. */
  candidates,
  defaultDate,
  /** Set when the dispatch token is missing, so the card can say so up front. */
  setupNeeded,
  actionsUrl,
}: {
  candidates: RecapCandidate[];
  defaultDate: string;
  setupNeeded: string | null;
  actionsUrl: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"recap" | "winners">("recap");
  const [date, setDate] = useState(defaultDate);
  const [to, setTo] = useState(defaultDate);
  const [picked, setPicked] = useState<string[]>([]);
  const [tiktok, setTiktok] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<string | null>(null);

  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.handle.includes(q) || c.displayName.toLowerCase().includes(q)
    );
  }, [candidates, filter]);

  function toggle(handle: string) {
    setPicked((p) => (p.includes(handle) ? p.filter((h) => h !== handle) : [...p, handle]));
  }

  async function start() {
    setBusy(true);
    setError(null);
    setStarted(null);
    const res = await fetch("/api/admin/recaps/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, date, to, handicappers: picked, tiktok }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not start the render.");
      return;
    }
    setStarted(
      `Rendering ${body.label} — ${body.settled} settled ${body.settled === 1 ? "pick" : "picks"}. It takes a couple of minutes and then appears below.`
    );
    // The video lands via the workflow, not this request, so there is nothing
    // to refresh into yet. Refreshing anyway keeps the list honest if an
    // earlier render finished while this page was open.
    router.refresh();
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <Clapperboard className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <h2 className="font-semibold">Create a recap</h2>
          <p className="text-sm text-muted">
            Nothing renders on its own. Choose a day and, if you want, which handicappers it
            covers.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["recap", "Day's card"],
            ["winners", "Winners reel"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={
              mode === key
                ? "rounded-full border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background"
                : "rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-medium">{mode === "winners" ? "From" : "Day"}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          />
        </label>
        {mode === "winners" && (
          <label className="block">
            <span className="text-xs font-medium">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
            />
          </label>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-medium">
            Handicappers{" "}
            <span className="text-muted">
              {picked.length === 0
                ? "— everyone"
                : `— ${picked.length} selected`}
            </span>
          </span>
          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked([])}
              className="text-xs text-muted underline hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {candidates.length > 8 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search handicappers"
            className="mt-2 block w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-muted"
          />
        )}

        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No handicapper has a settled pick yet, so there is nothing to make a recap from.
          </p>
        ) : (
          <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {shown.map((c) => {
              const on = picked.includes(c.handle);
              return (
                <button
                  key={c.handle}
                  type="button"
                  onClick={() => toggle(c.handle)}
                  title={`${c.displayName} — ${c.settled} settled`}
                  className={
                    on
                      ? "rounded-full border border-accent bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent"
                      : "rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
                  }
                >
                  @{c.handle}
                  <span className="ml-1 tabular-nums opacity-60">{c.settled}</span>
                </button>
              );
            })}
            {shown.length === 0 && (
              <p className="text-sm text-muted">Nobody matches &ldquo;{filter}&rdquo;.</p>
            )}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={tiktok}
          onChange={(e) => setTiktok(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <span>
          Also send it to TikTok drafts{" "}
          <span className="text-muted">— off by default; you can send any video later.</span>
        </span>
      </label>

      {setupNeeded && (
        <p className="text-xs text-muted">
          Starting a render from here needs a GitHub token in <code>{setupNeeded}</code> with
          permission to run workflows. Until that is set, use{" "}
          <a href={actionsUrl} target="_blank" rel="noopener" className="underline">
            the Actions tab
          </a>
          , which takes the same date and handicapper filters.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {started && <p className="text-sm text-accent">{started}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={busy || !date || candidates.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Starting…" : "Create recap"}
        </button>
        <a
          href={actionsUrl}
          target="_blank"
          rel="noopener"
          className="text-xs text-muted underline hover:text-foreground"
        >
          Watch it run
        </a>
      </div>
    </div>
  );
}
