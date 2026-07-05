import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";

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

function wrapInTemplate(bodyHtml: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#13161c">
    <p style="font-weight:700;font-size:18px;margin:0 0 16px">Blitz<span style="color:#16a34a">.tips</span></p>
    <div style="line-height:1.6;font-size:15px">${bodyHtml}</div>
    <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:12px">
      You're receiving this because you have an account on blitz.tips.
    </p>
  </div>`;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

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

  const recipients = await prisma.user.findMany({
    where,
    select: { email: true },
  });

  const html = wrapInTemplate(sanitizeHtml(rawHtml));
  const text = htmlToText(rawHtml);

  let sent = 0;
  let failed = 0;

  // Modest parallelism keeps us under Resend's rate limits without a queue.
  const CHUNK = 10;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((r) => sendEmail({ to: r.email, subject, html, text }))
    );
    for (const result of results) {
      if (result.status === "fulfilled") sent += 1;
      else failed += 1;
    }
  }

  return NextResponse.json({ sent, failed, audience });
}
