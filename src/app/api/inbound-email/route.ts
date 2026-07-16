import { NextResponse, after } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailWrapper, escapeHtml } from "@/lib/email-template";
import { ticketIdFromAddresses, parseEmailAddress, stripQuotedReply, htmlToText } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const CONTACT_TO = process.env.CONTACT_EMAIL?.trim() || "support@blitz.tips";

/**
 * Resend Inbound webhook — threads a customer's email reply back into its
 * ticket so the whole conversation lives in the admin Tickets tab.
 *
 * Flow: verify the Svix signature → confirm it's an `email.received` event →
 * find the ticket from the per-ticket reply address (or the #REF in the subject)
 * → fetch the body (the webhook carries metadata only) → append it as a CUSTOMER
 * message, reopen the ticket, and email the team a heads-up.
 *
 * Setup: point MX for INBOUND_EMAIL_DOMAIN (a dedicated subdomain) at Resend
 * Inbound and add an inbound route to this endpoint; set RESEND_WEBHOOK_SECRET
 * to that endpoint's signing secret.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) {
    console.error("[inbound-email] RESEND_WEBHOOK_SECRET / RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Inbound email not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const resend = new Resend(apiKey);

  let event;
  try {
    event = resend.webhooks.verify({
      payload: raw,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch (err) {
    console.error("[inbound-email] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Ignore everything but inbound mail (delivery/bounce events also hit here).
  if (event.type !== "email.received") return NextResponse.json({ ok: true });

  const data = event.data;

  // Which ticket? The per-ticket reply address carries the id; fall back to the
  // #REF in the subject for clients that rewrote the address.
  const recipients = [...(data.received_for ?? []), ...(data.to ?? [])];
  let ticket = null;
  const tokenId = ticketIdFromAddresses(recipients);
  if (tokenId) ticket = await prisma.ticket.findUnique({ where: { id: tokenId } });
  if (!ticket) {
    const ref = (data.subject ?? "").match(/#([A-Z0-9]{8})\b/i);
    if (ref) ticket = await prisma.ticket.findFirst({ where: { id: { endsWith: ref[1].toLowerCase() } } });
  }
  // 200 even when we can't match, so Resend doesn't retry a message we'll never
  // be able to place.
  if (!ticket) {
    console.warn("[inbound-email] no matching ticket for", recipients, data.subject);
    return NextResponse.json({ ok: true });
  }

  // Only the ticket's own customer can add to its thread.
  const sender = parseEmailAddress(data.from);
  if (sender !== ticket.email.toLowerCase()) {
    console.warn(`[inbound-email] sender ${sender} != ticket ${ticket.email}; dropping`);
    return NextResponse.json({ ok: true });
  }

  // The webhook is metadata-only; fetch the body separately.
  let body = "";
  try {
    const full = await resend.emails.receiving.get(data.email_id);
    const rec = full.data;
    body = stripQuotedReply(rec?.text || htmlToText(rec?.html ?? "") || "");
  } catch (err) {
    console.error("[inbound-email] failed to fetch body:", err);
  }
  if (!body) body = "(the customer replied, but the message body could not be read)";
  if (body.length > 8000) body = body.slice(0, 8000);

  await prisma.ticketMessage.create({ data: { ticketId: ticket.id, author: "CUSTOMER", body } });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN", updatedAt: new Date() } });

  const ref = ticket.id.slice(-8).toUpperCase();
  after(async () => {
    const html = emailWrapper({
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
      html,
      text: `New customer reply on ticket #${ref} from ${ticket.email}:\n\n${body}\n\nOpen the admin Tickets tab to reply.`,
    });
  });

  return NextResponse.json({ ok: true });
}
