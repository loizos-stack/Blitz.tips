"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tail / fade control for a pick.
 *
 * Social proof at the point of decision — "142 are on this" is the thing a
 * reader weighs before following a play, and it's the cheapest engagement a
 * marketplace has.
 *
 * Counts update optimistically, because the interesting number is the one next
 * to the button you just pressed and a round trip makes it feel broken. The
 * server's own counts replace them on response, so a rejected click (kickoff
 * passed, subscription lapsed) snaps back with the reason rather than leaving a
 * number that was never true.
 *
 * Pressing the side you're already on clears it — the same affordance as an
 * upvote, and the reason the API takes null.
 */
export function TailButtons({
  pickId,
  tails,
  fades,
  mine,
  disabled = false,
  disabledReason,
}: {
  pickId: string;
  tails: number;
  fades: number;
  /** true = tailed, false = faded, null = no position. */
  mine: boolean | null;
  /** Locked, already started, or the reader's own pick. */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState({ tails, fades, mine });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function choose(side: boolean) {
    if (busy || disabled) return;
    const next = state.mine === side ? null : side;

    // Optimistic: remove the old vote, add the new one.
    const optimistic = { ...state, mine: next };
    if (state.mine === true) optimistic.tails -= 1;
    if (state.mine === false) optimistic.fades -= 1;
    if (next === true) optimistic.tails += 1;
    if (next === false) optimistic.fades += 1;
    setState(optimistic);
    setError(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/picks/${pickId}/tail`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tailed: next }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setState({ tails, fades, mine }); // server said no — show the truth
        setError(body?.error ?? "Couldn't save that. Try again.");
        return;
      }
      setState({ tails: body.tails, fades: body.fades, mine: body.mine });
      router.refresh();
    } catch {
      setState({ tails, fades, mine });
      setError("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => choose(true)}
        disabled={disabled || busy}
        title={disabled ? disabledReason : state.mine === true ? "Remove your tail" : "Tail this pick"}
        aria-pressed={state.mine === true}
        className={cn(
          base,
          state.mine === true
            ? "border-accent bg-accent/15 text-accent"
            : "border-border text-muted hover:text-foreground"
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Tail
        <span className="tabular-nums">{state.tails}</span>
      </button>

      <button
        type="button"
        onClick={() => choose(false)}
        disabled={disabled || busy}
        title={disabled ? disabledReason : state.mine === false ? "Remove your fade" : "Fade this pick"}
        aria-pressed={state.mine === false}
        className={cn(
          base,
          state.mine === false
            ? "border-danger bg-danger/15 text-danger"
            : "border-border text-muted hover:text-foreground"
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        Fade
        <span className="tabular-nums">{state.fades}</span>
      </button>

      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
