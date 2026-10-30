"use client";

import { useSyncExternalStore } from "react";
import { formatDateTimeInZone, zoneAbbreviation } from "@/lib/date-format";

const emptySubscribe = () => () => {};

/**
 * A moment in time, in the visitor's own timezone.
 *
 * A handicapper in Istanbul posting a 01:00 kickoff and a subscriber in New
 * York reading it are looking at the same instant from eight hours apart. The
 * database stores that instant, so the only question is who does the
 * converting — and it cannot be the server, which runs in UTC and has no idea
 * where the reader is. So it is done here, in the browser, where the answer is
 * simply `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 *
 * The server snapshot pins UTC so the HTML and the hydration pass agree; the
 * client snapshot is the real zone, and React re-renders once hydrated. The
 * shape is always dd/MM/yyyy HH:mm (see lib/date-format) — only the instant
 * shown differs, never the format.
 *
 * `withZone` labels it ("21:00 EDT"). Worth it wherever someone might act on
 * the time, because the first paint is unavoidably UTC: labelled, that frame
 * is merely a different zone, rather than the wrong time with nothing to say
 * so.
 */
export function LocalTime({
  iso,
  withZone = false,
  withSeconds = false,
}: {
  iso: string;
  withZone?: boolean;
  /** Seconds too — for logs, where the order within a minute is the point. */
  withSeconds?: boolean;
}) {
  const render = (zone?: string) =>
    withZone
      ? `${formatDateTimeInZone(iso, zone, withSeconds)} ${zoneAbbreviation(iso, zone)}`
      : formatDateTimeInZone(iso, zone, withSeconds);

  const text = useSyncExternalStore(
    emptySubscribe,
    () => render(undefined),
    () => render("UTC")
  );

  return <span suppressHydrationWarning>{text}</span>;
}
