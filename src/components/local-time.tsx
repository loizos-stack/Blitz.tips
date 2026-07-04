"use client";

import { useSyncExternalStore } from "react";

function formatIn(iso: string, locale: string | undefined, timeZone: string | undefined): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", timeZone });
  const time = d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone });
  return `${date} · ${time}`;
}

const emptySubscribe = () => () => {};

// Renders an event's kickoff time in the visitor's own timezone. The server
// snapshot is a deterministic en-US/UTC string so hydration matches; on the
// client, useSyncExternalStore swaps in the browser's locale and timezone.
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    emptySubscribe,
    () => formatIn(iso, undefined, undefined),
    () => formatIn(iso, "en-US", "UTC")
  );

  return <span suppressHydrationWarning>{text}</span>;
}
