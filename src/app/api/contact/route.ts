import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const CONTACT_TO = process.env.CONTACT_EMAIL ?? "support@blitz.tips";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  // Honeypot — real users leave this empty; bots tend to fill every field.
  const website = typeof body.website === "string" ? body.website.trim() : "";

  if (website) return NextResponse.json({ ok: true }); // silently drop bots

  if (!name || name.length > 100) return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
  if (!message || message.length < 5 || message.length > 4000) {
    return NextResponse.json({ error: "Please enter a message" }, { status: 400 });
  }

  const heading = subject ? `Contact form: ${subject}` : "New contact form message";
  const text = [
    `From: ${name} <${email}>`,
    subject ? `Subject: ${subject}` : "",
    "",
    message,
  ].filter(Boolean).join("\n");
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;color:#13161c">
      <h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(heading)}</h2>
      <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      ${subject ? `<p style="margin:0 0 12px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
      <div style="white-space:pre-wrap;line-height:1.5;border-top:1px solid #e5e7eb;padding-top:12px;color:#374151">${escapeHtml(message)}</div>
    </div>`;

  try {
    await sendEmail({ to: CONTACT_TO, subject: heading, html, text, replyTo: email });
  } catch (error) {
    console.error("Contact form send failed:", error);
    return NextResponse.json({ error: "Couldn't send your message — please try again later." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
