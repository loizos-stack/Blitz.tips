import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
// Both paths go through the batch sender — a message to one person is simply
// a batch of one, and sharing the path means they fail and report the same way.
import { sendEmailBatch, type BatchFailure } from "@/lib/email";
import { emailWrapper } from "@/lib/email-template";
import { unsubscribeUrl, unsubscribePostUrl } from "@/lib/unsubscribe";

const AUDIENCES = ["ALL", "HANDICAPPERS", "CUSTOMERS", "CONTEST_ENTRANTS", "USER"] as const;
type Audience = (typeof AUDIENCES)[number];

/**
 * "USER" is a message to one named person, and it is deliberately NOT a
 * one-recipient broadcast. Two things differ:
 *
 *  - It ignores the notifyEmail opt-out. Unsubscribing turns off
 *    announcements; it is not a request never to be replied to, and an admin
 *    answering someone who wrote in should not find the reply silently
 *    dropped.
 *  - It carries no unsubscribe footer, because there is no list to leave.
 *    This is the rule email-template.ts already states: an unsubscribe line is
 *    for marketing, transactional mail leaves it undefined.
 *
 * What keeps that from being a hole: one recipient, chosen from a lookup
 * rather than typed, and the audit line names them.
 */

// Admin-authored content, but strip the obviously dangerous bits anyway.
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * How recently someone must have received this subject to be skipped.
 *
 * A day, because the case this serves is "that send half failed, let me run it
 * again" — which happens within minutes, not weeks. A deliberate re-run of the
 * same subject next week is a different message to the same people, and
 * blocking it would be the guard overreaching.
 */
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** What counts as "the same email" — case and stray spacing shouldn't matter. */
const subjectKeyOf = (subject: string) => subject.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Split a recipient list into who still needs this and who already has it.
 *
 * Matches on arrival, not on attempt: EmailDelivery only holds successes, so
 * the eighteen people a rate limit refused are still in `send` while the ten
 * who got it are not. That is the entire behaviour anyone wants from a resend.
 */
async function partitionByRecentDelivery(
  recipients: { id: string; email: string }[],
  subject: string,
  now: Date
): Promise<{ send: typeof recipients; skipped: typeof recipients }> {
  if (recipients.length === 0) return { send: [], skipped: [] };

  const already = await prisma.emailDelivery.findMany({
    where: {
      subjectKey: subjectKeyOf(subject),
      email: { in: recipients.map((r) => r.email) },
      sentAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) },
    },
    select: { email: true },
  });
  const seen = new Set(already.map((a) => a.email));
  return {
    send: recipients.filter((r) => !seen.has(r.email)),
    skipped: recipients.filter((r) => seen.has(r.email)),
  };
}

export async function POST(request: Request) {
  const ctx = await requirePermission("emails");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const body = await request.json().catch(() => ({}));
  const audience: Audience = AUDIENCES.includes(body.audience) ? body.audience : "ALL";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const rawHtml = typeof body.html === "string" ? body.html.trim() : "";

  if (!subject || !rawHtml) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  let recipients: { id: string; email: string }[];
  /** The audit line's target — who this actually went to. */
  let auditTarget: string = audience;

  if (audience === "USER") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
      : null;
    if (!user) {
      return NextResponse.json({ error: "Pick someone to send this to." }, { status: 400 });
    }
    recipients = [user];
    auditTarget = user.email;
  } else {
    const where =
      audience === "HANDICAPPERS"
        ? { handicapper: { isNot: null } }
        : audience === "CUSTOMERS"
          ? { handicapper: { is: null } }
          : audience === "CONTEST_ENTRANTS"
            ? { contestEntries: { some: {} } }
            : {};

    // A broadcast is non-operational, so it only goes to users who haven't
    // unsubscribed (notifyEmail), and each carries a per-user unsubscribe link.
    recipients = await prisma.user.findMany({
      where: { ...where, notifyEmail: true },
      select: { id: true, email: true },
    });
  }

  const isBroadcast = audience !== "USER";
  const now = new Date();

  // The guard applies to broadcasts only. A message to one named person is
  // correspondence — writing to the same person twice about the same thing is
  // a normal thing to do, and silently refusing it would be baffling.
  // `resend: true` from the composer's "send anyway" overrides it.
  const skipRecent = isBroadcast && body.resend !== true;
  const { send: toSend, skipped } = skipRecent
    ? await partitionByRecentDelivery(recipients, subject, now)
    : { send: recipients, skipped: [] as typeof recipients };

  // Asked before the confirm dialog, so the numbers in it are the real ones.
  if (body.action === "check") {
    return NextResponse.json({
      total: recipients.length,
      skipped: skipped.length,
      willSend: toSend.length,
      windowHours: DEDUPE_WINDOW_MS / 3_600_000,
    });
  }

  if (toSend.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      skipped: skipped.length,
      audience,
      reasons: [],
      failedSample: [],
    });
  }

  recipients = toSend;

  const bodyHtml = sanitizeHtml(rawHtml);
  const text = htmlToText(rawHtml);

  let sent = 0;
  const failures: BatchFailure[] = [];

  // One request per 100 recipients, not one per recipient.
  //
  // This used to fire ten concurrent sends per chunk, which is ten requests
  // against a limit counted in requests per second. A 28-person send delivered
  // the first ten and failed the remaining eighteen — the shape of a burst
  // going through a token bucket, not of a bad mailing list. The batch
  // endpoint carries up to 100 messages in a single call, so the limit stops
  // deciding who gets the email.
  const BATCH = 100;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH);
    const result = await sendEmailBatch(
      chunk.map((r) => ({
        to: r.email,
        subject,
        html: emailWrapper({
          bodyHtml,
          ...(isBroadcast ? { unsubscribeUrl: unsubscribeUrl(r.id) } : {}),
        }),
        text,
        ...(isBroadcast ? { listUnsubscribeUrl: unsubscribePostUrl(r.id) } : {}),
      }))
    );
    sent += result.sent;
    failures.push(...result.failures);

    // Record arrivals, not attempts. Everyone in this chunk the provider did
    // not name as a failure got the message, so a resend must skip them —
    // and everyone it did name must stay eligible for the retry.
    if (isBroadcast) {
      const rejected = new Set(result.failures.map((f) => f.email));
      const delivered = chunk.filter((r) => !rejected.has(r.email));
      if (delivered.length > 0) {
        await prisma.emailDelivery
          .createMany({
            data: delivered.map((r) => ({
              userId: r.id,
              email: r.email,
              subjectKey: subjectKeyOf(subject),
              subject,
              audience,
              sentAt: now,
            })),
          })
          // A lost delivery record costs a duplicate on the next resend. Losing
          // the send itself because bookkeeping failed would cost more.
          .catch((e) => console.error("[email] recording deliveries failed:", e));
      }
    }
  }
  const failed = failures.length;

  await logAdmin(
    session,
    "email.send",
    isBroadcast ? "Broadcast" : "DirectEmail",
    auditTarget,
    `"${subject}" → ${sent} sent, ${failed} failed` +
      (skipped.length ? `, ${skipped.length} skipped as already delivered` : "") +
      (failed ? ` (${[...new Set(failures.map((f) => f.reason))].slice(0, 3).join("; ")})` : "")
  );

  // The reasons go back to the sender, not just the tally. A bare "18 failed"
  // sends someone to the logs to find out whether their list is wrong or the
  // provider refused them, and until now the logs did not say either.
  return NextResponse.json({
    sent,
    failed,
    skipped: skipped.length,
    audience,
    reasons: [...new Set(failures.map((f) => f.reason))].slice(0, 5),
    failedSample: failures.slice(0, 10),
  });
}
