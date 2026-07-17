import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailWrapper, escapeHtml } from "@/lib/email-template";
import { ticketIdFromAddresses, ticketRefFromText, parseEmailAddress, stripQuotedReply, htmlToText } from "@/lib/tickets";

export const dynamic = "force-dynamic";

const CONTACT_TO = process.env.CONTACT_EMAIL?.trim() || "support@blitz.tips";

/**
 * Inbound-email webhook — threads a customer's email reply back into its ticket
 * so the whole conversation lives in the admin Tickets tab.
 *
 * Flow: check the shared secret → read the JSON the inbound source posts → find
 * the ticket from the per-ticket reply address (or the #REF in the subject) →
 * append the reply as a CUSTOMER message, reopen the ticket, and email the team.
 *
 * Setup (Cloudflare Email Routing): enable Email Routing on a dedicated
 * subdomain (INBOUND_EMAIL_DOMAIN, e.g. "parse.blitz.tips") so your root MX /
 * Google Workspace inbox is untouched, then route that subdomain to the Email
 * Worker in `workers/inbound-email/`. The Worker parses the message and POSTs
 * `{ from, to, subject, text, html }` here with an `Authorization: Bearer
 * <INBOUND_WEBHOOK_SECRET>` header. (A `?token=` query param is also accepted,
 * so any inbound service that can't send headers still works.)
 */
function secretOk(request: Request): boolean {
  const expected = process.env.INBOUND_WEBHOOK_SECRET;
  if (!expected) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const query = new URL(request.url).searchParams.get("token") ?? "";
  const given = bearer || query;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    // Full raw MIME — sent by the dependency-free Cloudflare Worker so parsing
    // happens here (lets the Worker be pasted straight into the dashboard).
    raw?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  let fromHeader = typeof payload.from === "string" ? payload.from : "";
  let subject = typeof payload.subject === "string" ? payload.subject : "";
  let text = typeof payload.text === "string" ? payload.text : "";
  let html = typeof payload.html === "string" ? payload.html : "";

  // If the source forwarded the raw message, parse it for the body (and fill any
  // missing envelope bits). Envelope from/to already provided by the Worker win.
  if (typeof payload.raw === "string" && payload.raw.length > 0) {
    try {
      const { default: PostalMime } = await import("postal-mime");
      const parsed = await PostalMime.parse(payload.raw);
      text = text || parsed.text || "";
      html = html || parsed.html || "";
      subject = subject || parsed.subject || "";
      if (!fromHeader && parsed.from?.address) fromHeader = parsed.from.address;
    } catch (err) {
      console.error("[inbound-email] raw MIME parse failed:", err);
    }
  }

  // The recipient carries the per-ticket reply token (reply+<id>@domain).
  const recipients: string[] = Array.isArray(payload.to)
    ? payload.to
    : typeof payload.to === "string"
      ? payload.to.split(",")
      : [];

  // Which ticket? A per-ticket plus address carries the id (if the inbound
  // setup can route one); otherwise match on the #REF that every ticket email
  // carries — first the subject, then the quoted body of the reply.
  let ticket = null;
  const tokenId = ticketIdFromAddresses(recipients);
  if (tokenId) ticket = await prisma.ticket.findUnique({ where: { id: tokenId } });
  if (!ticket) {
    const ref = ticketRefFromText(subject, text, htmlToText(html));
    if (ref) ticket = await prisma.ticket.findFirst({ where: { id: { endsWith: ref } } });
  }
  // 200 even when unmatched, so the sender doesn't retry a message we can't place.
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
