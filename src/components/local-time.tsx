"use client";

import { useSyncExternalStore } from "react";
import { formatDateTimeInZone } from "@/lib/date-format";

const emptySubscribe = () => () => {};

// Renders an event's kickoff time in the visitor's own timezone. The shape is
// always dd/MM/yyyy HH:mm (see lib/date-format) — only the timezone varies, so
// the server snapshot and the client render differ in the instant they show,
// never in the format. The server snapshot pins UTC so hydration matches.
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    emptySubscribe,
    () => formatDateTimeInZone(iso),
    () => formatDateTimeInZone(iso, "UTC")
  );

  return <span suppressHydrationWarning>{text}</span>;
}
