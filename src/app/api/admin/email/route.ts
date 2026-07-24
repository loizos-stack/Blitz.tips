import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { emailWrapper } from "@/lib/email-template";
import { unsubscribeUrl, unsubscribePostUrl } from "@/lib/unsubscribe";

const AUDIENCES = ["ALL", "HANDICAPPERS", "CUSTOMERS"] as const;
type Audience = (typeof AUDIENCES)[number];

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

  const where =
    audience === "HANDICAPPERS"
      ? { handicapper: { isNot: null } }
      : audience === "CUSTOMERS"
        ? { handicapper: { is: null } }
        : {};

  // A broadcast is non-operational, so it only goes to users who haven't
  // unsubscribed (notifyEmail), and each carries a per-user unsubscribe link.
  const recipients = await prisma.user.findMany({
    where: { ...where, notifyEmail: true },
    select: { id: true, email: true },
  });

  const bodyHtml = sanitizeHtml(rawHtml);
  const text = htmlToText(rawHtml);

  let sent = 0;
  let failed = 0;

  // Modest parallelism keeps us under Resend's rate limits without a queue.
  const CHUNK = 10;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((r) =>
        sendEmail({
          to: r.email,
          subject,
          html: emailWrapper({ bodyHtml, unsubscribeUrl: unsubscribeUrl(r.id) }),
          text,
          listUnsubscribeUrl: unsubscribePostUrl(r.id),
        })
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled") sent += 1;
      else failed += 1;
    }
  }

  await logAdmin(session, "email.send", "Broadcast", audience, `"${subject}" → ${sent} sent, ${failed} failed`);
  return NextResponse.json({ sent, failed, audience });
}
