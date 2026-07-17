import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailWrapper, escapeHtml } from "@/lib/email-template";
import { ticketReplyAddress } from "@/lib/tickets";

const CONTACT_TO = process.env.CONTACT_EMAIL ?? "support@blitz.tips";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  // Honeypot — real users leave this empty; bots tend to fill every field.
  const website = typeof body.website === "string" ? body.website.trim() : "";

  if (website) return NextResponse.json({ ok: true }); // silently drop bots

  if (!name || name.length > 100) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  if (!subject || subject.length > 150) return NextResponse.json({ error: "Please enter a subject" }, { status: 400 });
  if (!message || message.length < 5 || message.length > 4000) {
    return NextResponse.json({ error: "Please enter a message" }, { status: 400 });
  }

  // Open a ticket so the whole conversation is tracked and answerable from the
  // admin panel. The visitor's message is the first entry in the thread.
  const ticket = await prisma.ticket.create({
    data: {
      name,
      email,
      subject: subject || null,
      messages: { create: { author: "CUSTOMER", body: message } },
    },
  });

  const ticketRef = ticket.id.slice(-8).toUpperCase();
  const adminHeading = subject ? `New ticket: ${subject}` : "New support ticket";

  // Email the team (so they know a ticket came in) and the customer (so they
  // know we got it). Best-effort after responding — a mail hiccup shouldn't
  // fail the submission now that the ticket is safely stored.
  after(async () => {
    const adminHtml = emailWrapper({
      preheader: adminHeading,
      bodyHtml: `
        <h1 style="font-size:20px;margin:0 0 4px;color:#13161c;">${escapeHtml(adminHeading)}</h1>
        <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">Ticket #${ticketRef}</p>
        <p style="margin:0 0 4px;color:#13161c;"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        ${subject ? `<p style="margin:0 0 16px;color:#13161c;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
        <div style="white-space:pre-wrap;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;color:#374151;">${escapeHtml(message)}</div>
      `,
    });
    const adminText = [
      `New support ticket #${ticketRef}`,
      `From: ${name} <${email}>`,
      subject ? `Subject: ${subject}` : "",
      "",
      message,
    ].filter(Boolean).join("\n");

    const customerHtml = emailWrapper({
      preheader: "We received your message and opened a support ticket.",
      bodyHtml: `
        <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Thanks, ${escapeHtml(name)} — we got your message</h1>
        <p style="margin:0 0 16px;color:#4b5563;">Your message has been received and we&rsquo;ve opened support ticket <strong>#${ticketRef}</strong>. Our team will get back to you at this email address as soon as possible.</p>
        ${subject ? `<p style="margin:0 0 4px;color:#13161c;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
        <div style="white-space:pre-wrap;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;color:#374151;">${escapeHtml(message)}</div>
        <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">You&rsquo;re receiving this because you contacted Blitz.tips. If this wasn&rsquo;t you, you can ignore this email.</p>
      `,
    });
    const customerText = [
      `Thanks, ${name} — we got your message.`,
      `We've opened support ticket #${ticketRef} and will get back to you at ${email} as soon as possible.`,
      "",
      subject ? `Subject: ${subject}` : "",
      "",
      "Your message:",
      message,
    ].filter(Boolean).join("\n");

    await Promise.allSettled([
      sendEmail({ to: CONTACT_TO, subject: `${adminHeading} (#${ticketRef})`, html: adminHtml, text: adminText, replyTo: email }),
      // Reply-to is the ticket's own address so a customer replying to the
      // confirmation threads straight back into the ticket (and still reaches the
      // team) — the From address is a no-reply mailbox.
      sendEmail({ to: email, subject: `We received your message — Blitz.tips (#${ticketRef})`, html: customerHtml, text: customerText, replyTo: ticketReplyAddress() }),
    ]);
  });

  return NextResponse.json({ ok: true });
}
