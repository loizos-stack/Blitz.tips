import "server-only";
import { Resend } from "resend";
import { emailWrapper, emailLinkPill } from "@/lib/email-template";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Blitz.tips <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Send a transactional email. When RESEND_API_KEY isn't configured (e.g. local
 * dev) this logs instead of sending so flows that trigger email don't break —
 * the caller's action still succeeds. Always pass `text` alongside `html`:
 * multipart emails with a plain-text alternative score materially better with
 * spam filters than HTML-only mail.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  // One-click unsubscribe endpoint (RFC 8058) for non-operational mail — adds
  // the List-Unsubscribe headers so mail clients show a native Unsubscribe.
  listUnsubscribeUrl?: string;
}): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — would send "${opts.subject}" to ${opts.to}`);
    return;
  }
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.listUnsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${opts.listUnsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  });
  if (error) throw new Error(error.message);
}

export function verificationEmailText(url: string): string {
  return [
    "Welcome to Blitz.tips!",
    "",
    "Confirm your email address to finish setting up your account by opening this link:",
    url,
    "",
    "This link expires in 24 hours. If you didn't create a Blitz.tips account, you can ignore this email.",
  ].join("\n");
}

export function verificationCodeEmailText(code: string): string {
  return [
    "Welcome to Blitz.tips!",
    "",
    `Your verification code is: ${code}`,
    "",
    "Enter this code on the signup screen to finish setting up your account.",
    "It expires in 15 minutes. If you didn't create a Blitz.tips account, you can ignore this email.",
  ].join("\n");
}

export function verificationCodeEmailHtml(code: string): string {
  return emailWrapper({
    preheader: `Your verification code is ${code}`,
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Confirm your email</h1>
      <p style="color:#4b5563;margin:0 0 20px;">Welcome to Blitz.tips! Enter this code on the signup screen to finish setting up your account.</p>
      <p style="margin:0 0 20px;text-align:center;">
        <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;background:#f3f4f6;color:#13161c;padding:14px 22px;border-radius:12px;">${code}</span>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">This code expires in 15 minutes. If you didn't create a Blitz.tips account, you can ignore this email.</p>
    `,
  });
}

export function verificationEmailHtml(url: string): string {
  return emailWrapper({
    preheader: "Confirm your email to finish setting up your Blitz.tips account.",
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Confirm your email</h1>
      <p style="color:#4b5563;margin:0 0 24px;">Welcome to Blitz.tips! Confirm your email address to finish setting up your account.</p>
      <p style="margin:0 0 20px;text-align:center;">${emailLinkPill(url, "Verify email")}</p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">Or paste this link into your browser:</p>
      <p style="font-size:13px;word-break:break-all;margin:0 0 20px;"><a href="${url}" style="color:#16a34a;">${url}</a></p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">This link expires in 24 hours. If you didn't create a Blitz.tips account, you can ignore this email.</p>
    `,
  });
}
