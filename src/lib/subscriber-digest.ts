import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatOdds, unitProfit } from "@/lib/odds";
import { siteUrl } from "@/lib/site";
import { emailWrapper, emailLinkPill, escapeHtml } from "@/lib/email-template";
import { unsubscribeUrl, unsubscribePostUrl } from "@/lib/unsubscribe";
import { isPickLocked } from "@/lib/pick-visibility";
import { isSubscriptionActive } from "@/lib/subscription-status";
import type { PickResult } from "@prisma/client";

const SITE_URL = siteUrl();

export interface SubscriberDigestReport {
  considered: number;
  sent: number;
  skippedNoActivity: number;
  skippedOptedOut: number;
  errors: string[];
}

interface DigestLine {
  handicapper: string;
  handle: string;
  text: string;
}

interface CapperRef {
  handicapper: { handle: string; displayName: string };
}
export type PostedPick = CapperRef & {
  selection: string;
  odds: number;
  matchup: string;
  isPremium: boolean;
  result: PickResult;
  eventStartsAt: Date;
  handicapperId: string;
};
export type SettledPick = CapperRef & {
  selection: string;
  odds: number;
  units: number;
  result: PickResult;
};

/**
 * A once-a-day summary of what a reader's handicappers did.
 *
 * Individual pick notifications are immediate and per-event; this is the other
 * cadence — the one for someone who doesn't want a ping per pick but does want
 * to know their cappers went 4-1 yesterday. Between them they cover both kinds
 * of subscriber without either channel having to compromise.
 *
 * Three things it deliberately does not do:
 *
 * - It never reveals a locked premium pick. A digest is an email, and an email
 *   is forwardable; a paid selection that leaks through a summary is the same
 *   leak as one on the page. Locked picks are counted, not described.
 * - It doesn't send when there's nothing to say. A digest that arrives daily
 *   regardless is the one people unsubscribe from, and an empty one costs the
 *   sender reputation for nothing.
 * - It only emails people who opted in and verified, with a working unsubscribe
 *   — same rules as every other email the site sends.
 */
export async function runSubscriberDigest(
  opts: { since?: Date; dryRun?: boolean } = {}
): Promise<SubscriberDigestReport> {
  const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const report: SubscriberDigestReport = {
    considered: 0,
    sent: 0,
    skippedNoActivity: 0,
    skippedOptedOut: 0,
    errors: [],
  };

  // Everyone who follows or subscribes to at least one handicapper.
  const users = await prisma.user.findMany({
    where: {
      suspendedAt: null,
      OR: [{ follows: { some: {} } }, { subscriptions: { some: {} } }],
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      notifyEmail: true,
      name: true,
      username: true,
      follows: { select: { handicapperId: true } },
      // isSubscriptionActive reads the whole row, so select the whole row
      // rather than a subset that happens to compile today.
      subscriptions: true,
    },
  });
  report.considered = users.length;

  for (const user of users) {
    if (!user.notifyEmail || !user.emailVerified || !user.email) {
      report.skippedOptedOut += 1;
      continue;
    }

    const activeSubs = new Set(
      user.subscriptions.filter((s) => isSubscriptionActive(s)).map((s) => s.handicapperId)
    );
    const handicapperIds = [
      ...new Set([...user.follows.map((f) => f.handicapperId), ...user.subscriptions.map((s) => s.handicapperId)]),
    ];
    if (handicapperIds.length === 0) {
      report.skippedNoActivity += 1;
      continue;
    }

    // Yesterday's two kinds of news: picks posted, and picks graded.
    const [posted, settled] = await Promise.all([
      prisma.pick.findMany({
        where: { handicapperId: { in: handicapperIds }, createdAt: { gte: since } },
        select: {
          id: true, matchup: true, selection: true, odds: true, isPremium: true,
          result: true, eventStartsAt: true, handicapperId: true,
          handicapper: { select: { handle: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.pick.findMany({
        where: {
          handicapperId: { in: handicapperIds },
          settledAt: { gte: since },
          result: { in: ["WIN", "LOSS"] },
        },
        select: {
          id: true, matchup: true, selection: true, odds: true, units: true, result: true,
          handicapper: { select: { handle: true, displayName: true } },
        },
        orderBy: { settledAt: "desc" },
        take: 40,
      }),
    ]);

    if (posted.length === 0 && settled.length === 0) {
      report.skippedNoActivity += 1;
      continue;
    }

    const { headline, newLines, resultLines } = buildDigest(posted, settled, activeSubs);

    if (opts.dryRun) {
      report.sent += 1;
      continue;
    }

    try {
      await sendEmail({
        to: user.email,
        subject: headline,
        text: digestText(headline, newLines, resultLines),
        html: digestHtml(headline, newLines, resultLines, unsubscribeUrl(user.id)),
        listUnsubscribeUrl: unsubscribePostUrl(user.id),
      });
      report.sent += 1;
    } catch (e) {
      report.errors.push(`${user.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return report;
}

/**
 * Turn a reader's day into the lines their email will contain.
 *
 * Pure and exported so the rule that matters — a locked premium pick is
 * counted, never described — can be asserted directly, rather than inferred
 * from an email nobody reads in a test.
 */
export function buildDigest(
  posted: PostedPick[],
  settled: SettledPick[],
  activeSubs: Set<string>
): { headline: string; newLines: DigestLine[]; resultLines: DigestLine[] } {
  const newLines: DigestLine[] = posted.map((p) => ({
    handicapper: p.handicapper.displayName,
    handle: p.handicapper.handle,
    text: isPickLocked(p, activeSubs.has(p.handicapperId))
      ? "Premium pick — subscribe to unlock"
      : `${p.selection} (${formatOdds(p.odds)}) — ${p.matchup}`,
  }));

  const resultLines: DigestLine[] = settled.map((p) => {
    const delta = unitProfit(p.odds, p.units, p.result);
    return {
      handicapper: p.handicapper.displayName,
      handle: p.handicapper.handle,
      text: `${p.result === "WIN" ? "✅" : "❌"} ${p.selection} — ${delta > 0 ? "+" : ""}${delta.toFixed(2)}u`,
    };
  });

  const wins = settled.filter((p) => p.result === "WIN").length;
  const losses = settled.length - wins;
  const net = settled.reduce((sum, p) => sum + unitProfit(p.odds, p.units, p.result), 0);
  const headline =
    settled.length > 0
      ? `Your handicappers went ${wins}-${losses} (${net >= 0 ? "+" : ""}${net.toFixed(2)}u)`
      : `${posted.length} new pick${posted.length === 1 ? "" : "s"} from your handicappers`;

  return { headline, newLines, resultLines };
}

function section(title: string, lines: DigestLine[]): string[] {
  if (lines.length === 0) return [];
  return [title, ...lines.map((l) => `  ${l.handicapper}: ${l.text}`), ""];
}

function digestText(headline: string, posted: DigestLine[], settled: DigestLine[]): string {
  return [
    headline,
    "",
    ...section("Results", settled),
    ...section("New picks", posted),
    `See everything: ${SITE_URL}/dashboard`,
    "",
    "You're getting this because you follow or subscribe to handicappers on Blitz.tips.",
  ].join("\n");
}

function htmlSection(title: string, lines: DigestLine[]): string {
  if (lines.length === 0) return "";
  const items = lines
    .map(
      (l) =>
        `<li style="margin:0 0 8px;color:#374151;font-size:14px;">
           <a href="${SITE_URL}/handicappers/${encodeURIComponent(l.handle)}" style="color:#13161c;font-weight:600;text-decoration:none;">${escapeHtml(l.handicapper)}</a>
           — ${escapeHtml(l.text)}
         </li>`
    )
    .join("");
  return `<h2 style="font-size:15px;margin:24px 0 10px;color:#13161c;">${escapeHtml(title)}</h2>
          <ul style="margin:0;padding-left:18px;">${items}</ul>`;
}

function digestHtml(
  headline: string,
  posted: DigestLine[],
  settled: DigestLine[],
  unsubscribeHref: string
): string {
  return emailWrapper({
    preheader: headline,
    unsubscribeUrl: unsubscribeHref,
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 4px;color:#13161c;">${escapeHtml(headline)}</h1>
      <p style="color:#6b7280;font-size:13px;margin:0;">Yesterday on Blitz.tips</p>
      ${htmlSection("Results", settled)}
      ${htmlSection("New picks", posted)}
      <p style="margin:28px 0 0;text-align:center;">${emailLinkPill(`${SITE_URL}/dashboard`, "Open your feed")}</p>
    `,
  });
}
