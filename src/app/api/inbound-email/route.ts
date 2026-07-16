import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailWrapper, escapeHtml } from "@/lib/email-template";
import { ticketIdFromAddresses, parseEmailAddress, stripQuotedReply, htmlToText } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const CONTACT_TO = process.env.CONTACT_EMAIL?.trim() || "support@blitz.tips";

/**
 * SendGrid Inbound Parse webhook — threads a customer's email reply back into
 * its ticket so the whole conversation lives in the admin Tickets tab.
 *
 * Flow: check the shared secret → parse the multipart form SendGrid posts →
 * find the ticket from the per-ticket reply address (or the #REF in the subject)
 * → append the reply as a CUSTOMER message, reopen the ticket, and email the
 * team a heads-up.
 *
 * Setup: point MX for INBOUND_EMAIL_DOMAIN (a dedicated subdomain, e.g.
 * "parse.blitz.tips") at `mx.sendgrid.net`, then in SendGrid → Settings →
 * Inbound Parse add that host with the destination URL
 * `https://<your-domain>/api/inbound-email?token=<INBOUND_WEBHOOK_SECRET>`.
 * SendGrid doesn't sign requests, so the secret in the query string is what
 * authenticates the call.
 */
function secretOk(request: Request): boolean {
  const expected = process.env.INBOUND_WEBHOOK_SECRET;
  if (!expected) return false;
  const given = new URL(request.url).searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const fromHeader = str("from");
  const subject = str("subject");
  const text = str("text");
  const html = str("html");

  // Recipients: the SMTP envelope `to` is the most reliable source of the
  // per-ticket address; fall back to the header `to`.
  const recipients: string[] = [];
  try {
    const env = JSON.parse(str("envelope") || "{}");
    if (Array.isArray(env.to)) recipients.push(...env.to);
  } catch {
    /* envelope missing or malformed — fall back to the header below */
  }
  recipients.push(...str("to").split(","));

  // Which ticket? The per-ticket reply address carries the id; fall back to the
  // #REF in the subject.
  let ticket = null;
  const tokenId = ticketIdFromAddresses(recipients);
  if (tokenId) ticket = await prisma.ticket.findUnique({ where: { id: tokenId } });
  if (!ticket) {
    const ref = subject.match(/#([A-Z0-9]{8})\b/i);
    if (ref) ticket = await prisma.ticket.findFirst({ where: { id: { endsWith: ref[1].toLowerCase() } } });
  }
  // 200 even when unmatched, so SendGrid doesn't retry a message we can't place.
  if (!ticket) {
    console.warn("[inbound-email] no matching ticket for", recipients, subject);
    return NextResponse.json({ ok: true });
  }

  // Only the ticket's own customer can add to its thread.
  const sender = parseEmailAddress(fromHeader);
  if (sender !== ticket.email.toLowerCase()) {
    console.warn(`[inbound-email] sender ${sender} != ticket ${ticket.email}; dropping`);
    return NextResponse.json({ ok: true });
  }

  let body = stripQuotedReply(text || htmlToText(html) || "");
  if (!body) body = "(the customer replied, but the message body was empty)";
  if (body.length > 8000) body = body.slice(0, 8000);

  await prisma.ticketMessage.create({ data: { ticketId: ticket.id, author: "CUSTOMER", body } });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN", updatedAt: new Date() } });

  const ref = ticket.id.slice(-8).toUpperCase();
  after(async () => {
    const htmlBody = emailWrapper({
      preheader: `Customer reply on ticket #${ref}`,
      bodyHtml: `
        <h1 style="font-size:20px;margin:0 0 4px;color:#13161c;">New customer reply</h1>
        <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">Ticket #${ref}${ticket.subject ? ` &middot; ${escapeHtml(ticket.subject)}` : ""}</p>
        <p style="margin:0 0 12px;color:#13161c;"><strong>${escapeHtml(ticket.name)}</strong> &lt;${escapeHtml(ticket.email)}&gt; wrote:</p>
        <div style="white-space:pre-wrap;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;color:#374151;">${escapeHtml(body)}</div>
        <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Open the Tickets tab in the admin panel to reply.</p>
      `,
    });
    await sendEmail({
      to: CONTACT_TO,
      subject: `Re: ${ticket.subject || "support ticket"} — customer reply (#${ref})`,
      html: htmlBody,
      text: `New customer reply on ticket #${ref} from ${ticket.email}:\n\n${body}\n\nOpen the admin Tickets tab to reply.`,
    });
  });

  return NextResponse.json({ ok: true });
}
