import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * First-party traffic stats: what gets recorded, and what deliberately isn't.
 *
 * (Site traffic — not to be confused with lib/analytics.ts, which is about a
 * handicapper's pick record.)
 *
 * The whole design follows from one constraint. The site's cookie banner gates
 * Google Analytics because GA writes a cookie; Vercel's analytics sits outside
 * that gate because it is cookieless and stores nothing on the device (see
 * components/analytics-gate.tsx). This has to meet the same bar or it would
 * have to go behind the banner too — which would mean measuring only the
 * visitors who clicked Accept, i.e. not measuring traffic at all.
 *
 * So: no cookie, no device id, no IP at rest. A visitor is a digest of their
 * IP and user agent salted with a secret that changes at midnight. Within a
 * day it tells two browsers apart; across days it cannot connect them, because
 * yesterday's salt is gone and the digest is not reversible.
 *
 * I am not a lawyer and this is not legal advice — if a regulator in a
 * particular market takes a stricter view of hashed IPs, the honest fix is to
 * move the tracker behind the consent gate, which is a one-line change at the
 * call site in layout.tsx.
 */

/** How long rows are kept before the daily sweep drops them. */
export const RETENTION_DAYS = 90;

/**
 * The salt for today.
 *
 * Derived rather than stored so there is nothing to rotate, leak or forget to
 * clean up: yesterday's salt stops existing the moment the date changes. It
 * depends on AUTH_SECRET, so a digest cannot be recomputed from an IP by
 * anyone who does not already hold the application's secrets.
 */
function dailySalt(now: Date): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${process.env.AUTH_SECRET ?? "dev"}|${day}`).digest("hex");
}

/** A visitor, for one day only. Truncated because 128 bits is plenty to count with. */
export function visitorDigest(ip: string, userAgent: string, now: Date = new Date()): string {
  return createHash("sha256")
    .update(`${dailySalt(now)}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Crawlers, previewers and uptime checks.
 *
 * Kept deliberately broad. A bot counted as a visitor inflates every number on
 * the page and quietly changes what you believe about your own traffic, which
 * is worse than a real visitor occasionally being missed.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|whatsapp|telegram|discord|slack|twitter|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|uptime|pingdom|monitor|curl|wget|python-requests|axios|go-http|java\/|okhttp|postman/i;

export function looksLikeBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true; // a real browser always sends one
  return BOT_PATTERN.test(userAgent);
}

export type Device = "mobile" | "tablet" | "desktop";

export function deviceFrom(userAgent: string): Device {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(userAgent)) return "mobile";
  return "desktop";
}

/**
 * The path, with anything identifying stripped.
 *
 * A query string on this site can carry an unsubscribe token, a verification
 * code or someone's search terms. None of it is wanted and all of it would sit
 * in the database for ninety days, so it is cut before the row is written
 * rather than filtered later.
 */
export function normalizePath(raw: string): string | null {
  let path: string;
  try {
    // Accepts a full URL or a bare path; the base is only there to satisfy URL.
    path = new URL(raw, "https://blitz.tips").pathname;
  } catch {
    return null;
  }
  if (!path.startsWith("/")) return null;
  // Trailing slash is the same page as without it.
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path.slice(0, 300) || "/";
}

/**
 * The referrer's host, or null for a direct visit.
 *
 * Only the host: another site's path can hold as much private detail as our
 * own, and "which sites send traffic" is the question anyone is actually
 * asking. Our own domain is dropped — internal navigation is not a referral.
 */
export function referrerHost(raw: string | null | undefined, selfHost: string): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (!host || host === selfHost.replace(/^www\./, "")) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/** Paths that are never counted — the admin tool should not be in its own numbers. */
export function isTrackablePath(path: string): boolean {
  return !/^\/(admin|api|_next)(\/|$)/.test(path);
}

// ---------------------------------------------------------------- reporting

export interface RangeTotals {
  views: number;
  visitors: number;
}

export interface Breakdown {
  label: string;
  views: number;
  visitors: number;
}

export interface DayPoint {
  day: string;
  views: number;
  visitors: number;
}

export interface TrafficReport {
  totals: RangeTotals;
  previousTotals: RangeTotals;
  perDay: DayPoint[];
  pages: Breakdown[];
  referrers: Breakdown[];
  countries: Breakdown[];
  devices: Breakdown[];
}

/**
 * Everything the admin page shows, for one window.
 *
 * Grouped in SQL rather than in JS: the alternative is pulling every row for
 * the range into memory to count them, which works until the day it doesn't.
 */
export async function trafficReport(days: number): Promise<TrafficReport> {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  // The window immediately before this one, so every figure can be shown as a
  // change rather than a number with no scale.
  const prevSince = new Date(since.getTime() - days * 86_400_000);

  const [totals, previousTotals, perDay, pages, referrers, countries, devices] = await Promise.all([
    rangeTotals(since, now),
    rangeTotals(prevSince, since),
    perDaySeries(since),
    breakdown("path", since),
    breakdown("referrer", since),
    breakdown("country", since),
    breakdown("device", since),
  ]);

  return { totals, previousTotals, perDay, pages, referrers, countries, devices };
}

async function rangeTotals(from: Date, to: Date): Promise<RangeTotals> {
  const rows = await prisma.$queryRaw<{ views: bigint; visitors: bigint }[]>`
    SELECT COUNT(*)::bigint AS views,
           COUNT(DISTINCT "visitorHash")::bigint AS visitors
    FROM "PageView"
    WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
  `;
  return { views: Number(rows[0]?.views ?? 0), visitors: Number(rows[0]?.visitors ?? 0) };
}

async function perDaySeries(since: Date): Promise<DayPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date; views: bigint; visitors: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day,
           COUNT(*)::bigint AS views,
           COUNT(DISTINCT "visitorHash")::bigint AS visitors
    FROM "PageView"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    views: Number(r.views),
    visitors: Number(r.visitors),
  }));
}

/** The columns breakdown() will group by — the only values it ever interpolates. */
const GROUPABLE = {
  path: '"path"',
  referrer: '"referrer"',
  country: '"country"',
  device: '"device"',
} as const;

/**
 * Top values of one column.
 *
 * The column is looked up in GROUPABLE rather than interpolated from the
 * argument, so nothing a request can influence ever reaches the SQL string. A
 * raw query is needed because Prisma cannot group and count distinct visitors
 * in one pass, and this is the discipline that makes it safe.
 */
async function breakdown(
  column: keyof typeof GROUPABLE,
  since: Date,
  limit = 12
): Promise<Breakdown[]> {
  const col = GROUPABLE[column];
  const rows = await prisma.$queryRawUnsafe<{ label: string; views: bigint; visitors: bigint }[]>(
    `SELECT COALESCE(${col}, '(direct)') AS label,
            COUNT(*)::bigint AS views,
            COUNT(DISTINCT "visitorHash")::bigint AS visitors
     FROM "PageView"
     WHERE "createdAt" >= $1
     GROUP BY 1
     ORDER BY views DESC
     LIMIT ${Number(limit)}`,
    since
  );
  return rows.map((r) => ({
    label: r.label,
    views: Number(r.views),
    visitors: Number(r.visitors),
  }));
}

/** Drop rows past the retention window. Called from the daily sweep. */
export async function prunePageViews(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.pageView.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) } },
  });
  return count;
}
