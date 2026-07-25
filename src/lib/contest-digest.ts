import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailWrapper, emailLinkPill, escapeHtml } from "@/lib/email-template";
import { unsubscribeUrl, unsubscribePostUrl } from "@/lib/unsubscribe";
import { siteUrl } from "@/lib/site";
import { computeStats } from "@/lib/odds";
import { formatCents } from "@/lib/utils";
import {
  activeEntrantCount,
  computeStandings,
  contestPhase,
  effectivePrizeLadderCents,
} from "@/lib/contest";
import { cappersBeating } from "@/lib/contest-funnel";
import type { CapperRow } from "@/components/contest/capper-list";

/**
 * Weekly recap email for contest entrants — the recurring touchpoint in the
 * contest funnel.
 *
 * Entrants need 100 graded picks to be eligible, which is a months-long
 * commitment, and the single biggest reason someone drops out is simply
 * forgetting. So once a week each entrant gets their own week back: record,
 * units, rank, and how many graded picks they still owe. Underneath it sits the
 * marketplace pitch — the handicappers currently beating their number — which is
 * the honest version of "why subscribe": these people are ahead of you.
 *
 * Only sends while the contest is live, only to entrants who have a verified
 * address and haven't opted out of email, and never to a disqualified entry.
 */

const DIGEST_WINDOW_DAYS = 7;
const SEND_BATCH_SIZE = 10;
const SITE_URL = siteUrl();

export interface ContestDigestReport {
  contest: string | null;
  phase: string;
  /** Entrants who met every send condition. */
  eligible: number;
  sent: number;
  /** Entrants skipped: disqualified, suspended, unverified, or opted out. */
  skipped: number;
  failed: number;
  dryRun: boolean;
}

export async function runContestDigest(
  opts: { dryRun?: boolean } = {}
): Promise<ContestDigestReport> {
  const dryRun = Boolean(opts.dryRun);

  const contest = await prisma.contest.findUnique({
    where: { slug: "supercapper" },
    include: {
      entries: {
        include: {
          picks: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              emailVerified: true,
              notifyEmail: true,
              suspendedAt: true,
            },
          },
        },
      },
    },
  });

  if (!contest) {
    return { contest: null, phase: "missing", eligible: 0, sent: 0, skipped: 0, failed: 0, dryRun };
  }

  const phase = contestPhase(contest);
  const base = { contest: contest.slug, phase, dryRun };
  // Nothing useful to say before it starts or after it's settled.
  if (phase !== "live") {
    return { ...base, eligible: 0, sent: 0, skipped: contest.entries.length, failed: 0 };
  }

  const prizeLadder = effectivePrizeLadderCents(contest, activeEntrantCount(contest.entries));
  const standings = computeStandings(contest.entries, {
    minPicks: contest.minPicks,
    prizeSplitCents: prizeLadder,
  });
  const standingByEntry = new Map(standings.map((s) => [s.entryId, s]));

  const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const targets = contest.entries.filter(
    (e) =>
      !e.disqualifiedAt &&
      !e.user.suspendedAt &&
      e.user.notifyEmail &&
      e.user.emailVerified &&
      e.user.email
  );

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += SEND_BATCH_SIZE) {
    const batch = targets.slice(i, i + SEND_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const standing = standingByEntry.get(entry.id) ?? null;
        // Graded *this week* — what actually happened to them since the last email.
        const weekStats = computeStats(entry.picks.filter((p) => p.settledAt && p.settledAt >= since));
        const postedThisWeek = entry.picks.filter((p) => p.createdAt >= since).length;
        const cappers = await cappersBeating(standing?.roi ?? null);

        const view: DigestView = {
          firstName: entry.user.username ?? entry.user.name ?? null,
          minPicks: contest.minPicks,
          settledPicks: standing?.settledPicks ?? 0,
          rank: standing?.rank ?? null,
          qualified: Boolean(standing?.qualified),
          prizeCents: standing?.prizeCents ?? 0,
          weekRecord: weekStats.record,
          weekSettled: weekStats.wins + weekStats.losses + weekStats.pushes,
          weekUnitsNet: weekStats.unitsNet,
          postedThisWeek,
          cappers,
        };

        if (dryRun) return;
        await sendEmail({
          to: entry.user.email!,
          subject: digestSubject(view),
          text: digestText(view),
          html: digestHtml(view, unsubscribeUrl(entry.user.id)),
          listUnsubscribeUrl: unsubscribePostUrl(entry.user.id),
        });
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") sent += 1;
      else {
        failed += 1;
        console.error("contest digest send failed:", r.reason);
      }
    }
  }

  return {
    ...base,
    eligible: targets.length,
    sent: dryRun ? 0 : sent,
    skipped: contest.entries.length - targets.length,
    failed,
  };
}

interface DigestView {
  firstName: string | null;
  minPicks: number;
  settledPicks: number;
  rank: number | null;
  qualified: boolean;
  prizeCents: number;
  weekRecord: string;
  weekSettled: number;
  weekUnitsNet: number;
  postedThisWeek: number;
  cappers: CapperRow[];
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;

function digestSubject(v: DigestView): string {
  if (v.weekSettled > 0) return `Your Supercapper week: ${v.weekRecord}, ${signed(v.weekUnitsNet)}u`;
  if (v.postedThisWeek > 0) return `${v.postedThisWeek} picks posted — none graded yet`;
  return "You didn't post a Supercapper pick this week";
}

/** "You're #4 overall" / "62 of 100 graded picks — 38 to go". */
function qualificationLine(v: DigestView): string {
  if (v.qualified && v.rank) {
    const prize = v.prizeCents > 0 ? ` — currently in the money for ${formatCents(v.prizeCents)}` : "";
    return `You're #${v.rank} overall${prize}.`;
  }
  const left = Math.max(0, v.minPicks - v.settledPicks);
  return `${v.settledPicks} of ${v.minPicks} graded picks — ${left} more to be eligible for the prize pool.`;
}

function weekLine(v: DigestView): string {
  if (v.weekSettled > 0) {
    return `This week you went ${v.weekRecord} for ${signed(v.weekUnitsNet)} units over ${v.weekSettled} graded picks.`;
  }
  if (v.postedThisWeek > 0) {
    return `You posted ${v.postedThisWeek} ${v.postedThisWeek === 1 ? "pick" : "picks"} this week — none have been graded yet.`;
  }
  return "You didn't post a pick this week. Every week without picks is a week further from the 100 you need.";
}

function digestText(v: DigestView): string {
  const lines = [
    v.firstName ? `${v.firstName},` : "Here's your Supercapper week.",
    "",
    weekLine(v),
    qualificationLine(v),
    "",
    `Post your picks: ${SITE_URL}/supercapper/dashboard`,
  ];

  if (v.cappers.length > 0) {
    lines.push("", "Handicappers beating your number right now:");
    for (const c of v.cappers) {
      const roi = c.roi != null ? `${signed(Math.round(c.roi * 10) / 10)}% ROI` : c.record;
      const price = c.monthlyPriceCents ? ` · ${formatCents(c.monthlyPriceCents)}/mo` : "";
      lines.push(`  - ${c.displayName} (${roi})${price} — ${SITE_URL}/handicappers/${c.handle}`);
    }
  }

  return lines.join("\n");
}

function digestHtml(v: DigestView, unsubscribeHref: string): string {
  const cappersHtml =
    v.cappers.length === 0
      ? ""
      : `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid #e5e7eb;padding-top:16px;">
        <tr><td style="padding-bottom:8px;color:#13161c;font-size:14px;font-weight:700;">Beating your number right now</td></tr>
        ${v.cappers
          .map((c) => {
            const roi = c.roi != null ? `${signed(Math.round(c.roi * 10) / 10)}%` : c.record;
            const price = c.monthlyPriceCents ? ` &middot; ${formatCents(c.monthlyPriceCents)}/mo` : "";
            return `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f2f4;font-size:14px;color:#4b5563;">
              <a href="${SITE_URL}/handicappers/${encodeURIComponent(c.handle)}" style="color:#13161c;text-decoration:none;font-weight:600;">${escapeHtml(c.displayName)}</a>
              <span style="color:#16a34a;font-weight:600;">&nbsp;${escapeHtml(roi)}</span>
              <span style="color:#9ca3af;">${price}</span>
            </td></tr>`;
          })
          .join("")}
        <tr><td style="padding-top:12px;font-size:13px;">
          <a href="${SITE_URL}/handicappers" style="color:#16a34a;text-decoration:none;font-weight:600;">Browse all handicappers &rarr;</a>
        </td></tr>
      </table>`;

  return emailWrapper({
    preheader: `${weekLine(v)} ${qualificationLine(v)}`,
    unsubscribeUrl: unsubscribeHref,
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Your Supercapper week</h1>
      <p style="color:#4b5563;font-size:15px;margin:0 0 8px;">${escapeHtml(weekLine(v))}</p>
      <p style="color:#4b5563;font-size:15px;margin:0 0 24px;">${escapeHtml(qualificationLine(v))}</p>
      <p style="margin:0 0 24px;text-align:center;">${emailLinkPill(`${SITE_URL}/supercapper/dashboard`, "Post your picks")}</p>
      ${cappersHtml}
      <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you entered the Supercapper contest on Blitz.tips.</p>
    `,
  });
}
