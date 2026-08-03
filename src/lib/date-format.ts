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
 * runtime's own zone). Used for kickoff times, which are shown to each visitor
 * in their local zone rather than in UTC.
 */
export function formatDateTimeInZone(value: DateLike, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat(ZONED_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(toDate(value));

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
