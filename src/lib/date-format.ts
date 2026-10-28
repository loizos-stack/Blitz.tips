// One date format for the whole site: dd/MM/yyyy, with 24-hour clock times.
//
// Every user-facing date goes through here rather than through `format(d,
// "MMM d, yyyy")` or `toLocaleDateString()` at the call site. The old spread
// mixed US month-first strings with browser-locale ones, so the same timestamp
// could read "Aug 10, 2026" on one page and "8/10/2026" on another — and
// "08/10/2026" is genuinely ambiguous between the two conventions.
//
// Plain module (no "server-only") on purpose: server pages and client
// components both render dates, and they must agree.
import { format } from "date-fns";

/** dd/MM/yyyy — the only date shape shown to users. */
export const DATE_PATTERN = "dd/MM/yyyy";
/** dd/MM/yyyy HH:mm — dates that need a clock time. 24-hour, to match dd/MM. */
export const DATE_TIME_PATTERN = "dd/MM/yyyy HH:mm";
/** dd/MM — for chart axes and other places where the year is already implied. */
export const DAY_MONTH_PATTERN = "dd/MM";

type DateLike = Date | string | number;

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

/** e.g. `10/08/2026` */
export function formatDate(value: DateLike): string {
  return format(toDate(value), DATE_PATTERN);
}

/** e.g. `10/08/2026 19:45` */
export function formatDateTime(value: DateLike): string {
  return format(toDate(value), DATE_TIME_PATTERN);
}

/** e.g. `10/08` — only where the surrounding copy already fixes the year. */
export function formatDayMonth(value: DateLike): string {
  return format(toDate(value), DAY_MONTH_PATTERN);
}

/**
 * e.g. `11 October 2026` — for EMAIL, and the one place the dd/MM/yyyy rule
 * above is deliberately set aside.
 *
 * That rule exists because `08/10/2026` is genuinely ambiguous between the
 * day-first and month-first conventions. A spelled-out month has no such
 * ambiguity, and mail is read outside the site by people who never learn its
 * conventions — a date that decides when someone's plan ends is the last place
 * to make a reader guess. The formatting still lives here so there is one
 * module that owns what a date looks like.
 */
export function formatDateLong(value: DateLike): string {
  return format(toDate(value), "d MMMM yyyy");
}

/** e.g. `Saturday 11 October` — a near date in email, where the day helps. */
export function formatDateWithWeekday(value: DateLike): string {
  return format(toDate(value), "EEEE d MMMM");
}

/** e.g. `10/08/2026 19:45:07` — admin logs, where the second matters. */
export function formatDateTimeSeconds(value: DateLike): string {
  return format(toDate(value), "dd/MM/yyyy HH:mm:ss");
}

// Intl options that produce dd/MM/yyyy and HH:mm in a caller-supplied timezone.
// `en-GB` is the locale whose defaults already match the house style; the
// explicit options mean we don't depend on that, only on the digit shapes.
const ZONED_LOCALE = "en-GB";

/**
 * The same dd/MM/yyyy HH:mm, but rendered in `timeZone` (undefined = the
 * runtime's own zone).
 *
 * Reach for this — through <LocalTime>, which supplies the visitor's zone —
 * for any moment in time a visitor needs to act on. `formatDateTime` above
 * formats in the RUNTIME's zone, which on a server-rendered page is the
 * Vercel lambda's: UTC, for everybody, wherever they are.
 */
export function formatDateTimeInZone(
  value: DateLike,
  timeZone?: string,
  /** Seconds too — for logs, where the ordering within a minute is the point. */
  withSeconds = false
): string {
  const parts = new Intl.DateTimeFormat(ZONED_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hour12: false,
    timeZone,
  }).formatToParts(toDate(value));

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const clock = withSeconds
    ? `${get("hour")}:${get("minute")}:${get("second")}`
    : `${get("hour")}:${get("minute")}`;
  return `${get("day")}/${get("month")}/${get("year")} ${clock}`;
}

/**
 * The short zone name for an instant — "EDT", "GMT+3", "UTC".
 *
 * Worth showing beside a kickoff even though it is the reader's own zone,
 * because a server-rendered page necessarily ships UTC first and corrects it
 * once the browser runs. Labelled, that first paint says something true;
 * unlabelled, it is a wrong time with nothing to mark it as wrong.
 *
 * Tied to the instant rather than the zone alone, since the same zone is EST
 * in January and EDT in July.
 */
export function zoneAbbreviation(value: DateLike, timeZone?: string): string {
  // en-US rather than the en-GB above, and only for this one part: en-GB names
  // New York "GMT-5", en-US names it "EST". Nothing else about the format is
  // taken from it, so the dd/MM house style is untouched. Zones with no
  // customary abbreviation still fall back to an offset ("GMT+3").
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(toDate(value));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}
