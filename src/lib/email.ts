import "server-only";
import { Resend } from "resend";
import { emailWrapper, emailLinkPill } from "@/lib/email-template";
import { siteUrl } from "@/lib/site";
import { formatDateLong, formatDateWithWeekday } from "@/lib/date-format";

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

export function passwordResetEmailText(url: string, ttlMinutes: number): string {
  return [
    "Reset your Blitz.tips password",
    "",
    "Open this link to choose a new password:",
    url,
    "",
    `This link expires in ${ttlMinutes} minutes and can only be used once.`,
    "",
    // The reassurance matters: this mail also lands in the inbox of anyone whose
    // address was typed in by someone else, and they should know that ignoring
    // it is genuinely enough.
    "If you didn't ask to reset your password, you can ignore this email — your password stays as it is.",
  ].join("\n");
}

export function passwordResetEmailHtml(url: string, ttlMinutes: number): string {
  return emailWrapper({
    preheader: "Choose a new password for your Blitz.tips account.",
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Reset your password</h1>
      <p style="color:#4b5563;margin:0 0 24px;">Choose a new password for your Blitz.tips account.</p>
      <p style="margin:0 0 20px;text-align:center;">${emailLinkPill(url, "Choose a new password")}</p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 4px;">Or paste this link into your browser:</p>
      <p style="font-size:13px;word-break:break-all;margin:0 0 20px;"><a href="${url}" style="color:#16a34a;">${url}</a></p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">This link expires in ${ttlMinutes} minutes and can only be used once. If you didn't ask to reset your password, you can ignore this email — your password stays as it is.</p>
    `,
  });
}

// --- comped plans -----------------------------------------------------------
//
// The three emails a handicapper gets when an admin gives them a Silver or
// Gold plan for a period: the grant, a warning three days before it ends, and
// confirmation once it has. Copy approved 11/09/2026.
//
// The thread running through all three is that losing the plan costs them
// nothing they built. A comp that ends feels like something being taken away,
// and the honest answer — picks, record, subscribers and payouts all survive,
// only the commission rate moves — is stated in every one of them rather than
// left for someone to worry about.

/** What the plan is worth, in the words the emails use. */
function compPerks(plan: "SILVER" | "GOLD"): string[] {
  const keep = plan === "GOLD" ? "10%, so you keep 90%" : "15%, so you keep 85%";
  const perks = [`Commission drops to <strong>${keep}</strong> of every subscription.`];
  if (plan === "GOLD") {
    perks.push("You're featured at the top of the homepage and the leaderboard.");
    perks.push("You're promoted on Blitz.tips social and in the newsletter.");
  }
  return perks;
}

function planPrices(plan: "SILVER" | "GOLD"): string {
  return plan === "GOLD" ? "$49.99 a month or $499.99 a year" : "$9.99 a month or $99.99 a year";
}

function commissionSwing(plan: "SILVER" | "GOLD"): string {
  return plan === "GOLD" ? "10% back to 20%" : "15% back to 20%";
}

export function compGrantedEmailHtml(
  plan: "SILVER" | "GOLD",
  endsAt: Date,
  willWarn: boolean
): string {
  const label = plan === "GOLD" ? "Gold" : "Silver";
  const url = `${siteUrl()}/dashboard/handicapper/plan`;
  const long = formatDateLong(endsAt);
  const short = formatDateLong(endsAt).replace(/ \d{4}$/, "");
  return emailWrapper({
    preheader: `Your ${label} plan is active until ${long} — no charge.`,
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">You're on ${label} until ${short}</h1>
      <p style="color:#4b5563;margin:0 0 16px;">We've put your account on the ${label} plan until <strong>${long}</strong>. There's nothing to pay and nothing to set up — it's live on your profile now.</p>
      <p style="color:#4b5563;margin:0 0 10px;">While you're on ${label}:</p>
      <ul style="color:#4b5563;margin:0 0 20px;padding-left:20px;">
        ${compPerks(plan).map((p) => `<li style="margin-bottom:7px;">${p}</li>`).join("")}
      </ul>
      <p style="margin:0 0 20px;text-align:center;">${emailLinkPill(url, "See your plan")}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">${
        willWarn ? "We'll email you three days before it ends. If you do nothing then, your" : "Your"
      } account returns to Free on ${short} — you keep your picks, your record and your subscribers, and commission goes back to 20%.</p>
    `,
  });
}

export function compGrantedEmailText(
  plan: "SILVER" | "GOLD",
  endsAt: Date,
  willWarn: boolean
): string {
  const label = plan === "GOLD" ? "Gold" : "Silver";
  const long = formatDateLong(endsAt);
  const short = formatDateLong(endsAt).replace(/ \d{4}$/, "");
  const perks = compPerks(plan).map((p) => ` - ${stripTags(p)}`);
  return [
    `You're on ${label} until ${short}`,
    "",
    `We've put your account on the ${label} plan until ${long}. There's nothing to pay`,
    "and nothing to set up - it's live on your profile now.",
    "",
    `While you're on ${label}:`,
    ...perks,
    "",
    `See your plan: ${siteUrl()}/dashboard/handicapper/plan`,
    "",
    willWarn
      ? `We'll email you three days before it ends. If you do nothing then, your account returns to Free on ${short} - you keep your picks, your record and your subscribers, and commission goes back to 20%.`
      : `Your account returns to Free on ${short} - you keep your picks, your record and your subscribers, and commission goes back to 20%.`,
  ].join("\n");
}

export function compEndingEmailHtml(plan: "SILVER" | "GOLD", endsAt: Date): string {
  const label = plan === "GOLD" ? "Gold" : "Silver";
  const url = `${siteUrl()}/dashboard/handicapper/plan`;
  const weekday = formatDateWithWeekday(endsAt);
  const short = formatDateLong(endsAt).replace(/ \d{4}$/, "");
  const featured =
    plan === "GOLD"
      ? " — and you'd no longer be featured on the homepage or the leaderboard"
      : "";
  return emailWrapper({
    preheader: `Keep ${label} for ${planPrices(plan).replace(" a month or", "/month, or")}, or do nothing and return to Free.`,
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Three days left on ${label}</h1>
      <p style="color:#4b5563;margin:0 0 16px;">Your complimentary ${label} plan ends on <strong>${weekday}</strong>. If you'd like to keep it, you can continue on ${label} for ${planPrices(plan)}.</p>
      <p style="color:#4b5563;margin:0 0 16px;">If you'd rather not, there's nothing to do. Your account moves to Free on ${short} and your picks, your record, your subscribers and your payouts all stay exactly as they are. The only change is commission, from ${commissionSwing(plan)}${featured}.</p>
      <p style="margin:0 0 20px;text-align:center;">${emailLinkPill(url, `Continue on ${label}`)}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">You can change or cancel a paid plan whenever you like from your dashboard.</p>
    `,
  });
}

export function compEndingEmailText(plan: "SILVER" | "GOLD", endsAt: Date): string {
  const label = plan === "GOLD" ? "Gold" : "Silver";
  const weekday = formatDateWithWeekday(endsAt);
  const short = formatDateLong(endsAt).replace(/ \d{4}$/, "");
  const featured =
    plan === "GOLD" ? " - and you'd no longer be featured on the homepage or the leaderboard" : "";
  return [
    `Three days left on ${label}`,
    "",
    `Your complimentary ${label} plan ends on ${weekday}. If you'd like to keep it,`,
    `you can continue on ${label} for ${planPrices(plan)}.`,
    "",
    `If you'd rather not, there's nothing to do. Your account moves to Free on`,
    `${short} and your picks, your record, your subscribers and your payouts all`,
    `stay exactly as they are. The only change is commission, from`,
    `${commissionSwing(plan)}${featured}.`,
    "",
    `Continue on ${label}: ${siteUrl()}/dashboard/handicapper/plan`,
    "",
    "You can change or cancel a paid plan whenever you like from your dashboard.",
  ].join("\n");
}

export function compEndedEmailHtml(plan: "SILVER" | "GOLD", endedAt: Date): string {
  const label = plan === "GOLD" ? "Gold" : "Silver";
  const url = `${siteUrl()}/dashboard/handicapper/plan`;
  const short = formatDateLong(endedAt).replace(/ \d{4}$/, "");
  return emailWrapper({
    preheader: "You're on Free. Your picks, record and subscribers are unchanged.",
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">Your ${label} plan has ended</h1>
      <p style="color:#4b5563;margin:0 0 16px;">Your complimentary ${label} plan ran out on ${short}, so your account is now on the Free plan.</p>
      <p style="color:#4b5563;margin:0 0 16px;">Nothing has been lost. Your picks, your public record, your subscribers and your payouts are all unchanged — commission on new subscriptions is now 20%.</p>
      <p style="color:#4b5563;margin:0 0 16px;">If you'd like ${label} back, you can pick it up any time.</p>
      <p style="margin:0 0 20px;text-align:center;">${emailLinkPill(url, "See the plans")}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">You haven't been charged for anything. ${label} was on us.</p>
    `,
  });
}

export function compEndedEmailText(plan: "SILVER" | "GOLD", endedAt: Date): string {
  const label = plan === "GOLD" ? "Gold" : "Silver";
  const short = formatDateLong(endedAt).replace(/ \d{4}$/, "");
  return [
    `Your ${label} plan has ended`,
    "",
    `Your complimentary ${label} plan ran out on ${short}, so your account is now`,
    "on the Free plan.",
    "",
    "Nothing has been lost. Your picks, your public record, your subscribers and",
    "your payouts are all unchanged - commission on new subscriptions is now 20%.",
    "",
    `If you'd like ${label} back, you can pick it up any time.`,
    "",
    `See the plans: ${siteUrl()}/dashboard/handicapper/plan`,
    "",
    `You haven't been charged for anything. ${label} was on us.`,
  ].join("\n");
}

/** The HTML perk lines double as plain-text ones once their <strong> is gone. */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}
