"use client";

import { useEffect, useRef } from "react";

/**
 * setInterval that only runs while the tab is actually being looked at.
 *
 * The admin panel refreshes itself so new tickets, chats and reviews appear
 * without a reload, and each tick is a server round trip. A plain interval
 * keeps doing that in a background tab for as long as the tab exists: one
 * admin screen left open overnight at ten seconds is roughly eight and a half
 * thousand requests nobody reads, which on a metered plan is real money spent
 * rendering pages into a hidden document.
 *
 * So the timer stops on `visibilitychange` and restarts when the tab comes
 * back — and fires once on the way back, because the first thing someone wants
 * on returning is the current state, not the state from when they left.
 *
 * Nothing here is a substitute for a push channel; it is the same polling,
 * aimed only at the people watching.
 */
export function useVisibleInterval(
  callback: () => void,
  intervalMs: number,
  /** Fire once when the tab regains focus. Off for heartbeats and the like. */
  { catchUpOnReturn = true }: { catchUpOnReturn?: boolean } = {}
): void {
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    // Mounting in a visible tab is not a return from anywhere — the page has
    // just rendered, so there is nothing to catch up on.
    let wasHidden = document.visibilityState === "hidden";

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer === null) timer = setInterval(() => saved.current(), intervalMs);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (wasHidden && catchUpOnReturn) saved.current();
        wasHidden = false;
        start();
      } else {
        wasHidden = true;
        stop();
      }
    };

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, catchUpOnReturn]);
}
