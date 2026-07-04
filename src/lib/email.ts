import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Blitz.tips <onboarding@resend.dev>";

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * Send a transactional email. When RESEND_API_KEY isn't configured (e.g. local
 * dev) this logs instead of sending so flows that trigger email don't break —
 * the caller's action still succeeds.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — would send "${opts.subject}" to ${opts.to}`);
    return;
  }
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw new Error(error.message);
}

export function verificationEmailHtml(url: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#13161c">
    <h1 style="font-size:20px;margin:0 0 12px">Confirm your email</h1>
    <p style="color:#4b5563;line-height:1.5">Welcome to Blitz.tips! Confirm your email address to finish setting up your account.</p>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">Verify email</a>
    </p>
    <p style="color:#6b7280;font-size:13px;line-height:1.5">Or paste this link into your browser:<br><a href="${url}" style="color:#16a34a">${url}</a></p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">This link expires in 24 hours. If you didn't create a Blitz.tips account, you can ignore this email.</p>
  </div>`;
}
