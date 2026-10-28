import "server-only";
import { getSetting } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { emailWrapper } from "@/lib/email-template";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { siteUrl } from "@/lib/site";

/**
 * Telling the people who run the site that something happened.
 *
 * One function, two channels, four events. The point of routing everything
 * through here rather than emailing from each call site is that the call sites
 * are a signup, a payment webhook and a support form — three places where an
 * alert must never be the reason the real work fails. Nothing in this file
 * throws, and nothing in it is awaited for correctness.
 */

export type AdminAlertKind =
  | "signup.subscriber"
  | "signup.handicapper"
  | "subscription.new"
  | "ticket.opened";

export const ALERT_KINDS: {
  key: AdminAlertKind;
  label: string;
  description: string;
  /** Channels this event can use. See the ticket note below. */
  channels: ("email" | "telegram")[];
}[] = [
  {
    key: "signup.subscriber",
    label: "New customer",
    description: "Someone registers an account",
    channels: ["email", "telegram"],
  },
  {
    key: "signup.handicapper",
    label: "New handicapper",
    description: "Someone creates a handicapper profile",
    channels: ["email", "telegram"],
  },
  {
    key: "subscription.new",
    label: "New subscription",
    description: "Someone buys a handicapper's package, by card or crypto",
    channels: ["email", "telegram"],
  },
  {
    // Telegram only, on purpose. The contact route already emails the team a
    // full copy of the message with reply-to set to the customer, so you can
    // answer by replying. A second, thinner email from here would be noise
    // competing with the one you actually want to read.
    key: "ticket.opened",
    label: "Support ticket",
    description: "A customer opens a ticket (the team email already goes out separately)",
    channels: ["telegram"],
  },
];

/** Where the Telegram alerts go. Set in Admin → Telegram. */
export const ALERT_CHAT_KEY = "alerts.telegram.chatId";

const settingKey = (kind: AdminAlertKind, channel: "email" | "telegram") =>
  `alerts.${kind}.${channel}`;

/**
 * Alerts are ON unless someone has turned them off.
 *
 * Defaulting to off would mean every one of these is silently dead until
 * somebody finds the switch — and the failure mode of a missed signup alert is
 * that you never learn you missed it.
 */
async function enabled(kind: AdminAlertKind, channel: "email" | "telegram"): Promise<boolean> {
  return (await getSetting(settingKey(kind, channel))) !== "false";
}

export async function alertSettings(): Promise<{
  chatId: string | null;
  telegramReady: boolean;
  toggles: Record<string, boolean>;
}> {
  const entries = await Promise.all(
    ALERT_KINDS.flatMap((k) =>
      k.channels.map(async (c) => [settingKey(k.key, c), await enabled(k.key, c)] as const)
    )
  );
  return {
    chatId: (await getSetting(ALERT_CHAT_KEY))?.trim() || null,
    telegramReady: telegramConfigured(),
    toggles: Object.fromEntries(entries),
  };
}

/** Telegram's HTML parse mode — these four would otherwise break the message. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface AdminAlert {
  kind: AdminAlertKind;
  /** One line, the thing you'd read on a lock screen. */
  title: string;
  /** `["Email", "a@b.com"]` pairs — the detail under the title. */
  details: [string, string][];
  /** Path into the admin panel, e.g. "/admin/tickets". */
  path?: string;
}

/**
 * Send one alert to whichever channels are switched on.
 *
 * Deliberately returns void and swallows everything. A caller that awaited a
 * meaningful result would be tempted to act on it, and the right action when
 * an alert fails is to carry on with the signup.
 */
export async function notifyAdmins(alert: AdminAlert): Promise<void> {
  await Promise.allSettled([sendAlertEmail(alert), sendAlertTelegram(alert)]);
}

/** Whether this event is allowed on this channel at all (see ALERT_KINDS). */
function carries(kind: AdminAlertKind, channel: "email" | "telegram"): boolean {
  return ALERT_KINDS.find((k) => k.key === kind)?.channels.includes(channel) ?? false;
}

async function sendAlertEmail(alert: AdminAlert): Promise<void> {
  try {
    if (!carries(alert.kind, "email")) return;
    if (!(await enabled(alert.kind, "email"))) return;
    const to = process.env.ADMIN_ALERT_EMAIL ?? process.env.CONTACT_EMAIL ?? "support@blitz.tips";
    const link = alert.path ? `${siteUrl()}${alert.path}` : null;

    const rows = alert.details
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">${escapeHtml(k)}</td>` +
          `<td style="padding:4px 0;font-weight:600;">${escapeHtml(v)}</td></tr>`
      )
      .join("");

    await sendEmail({
      to,
      subject: alert.title,
      // No unsubscribe footer: this is operational mail to the operator, not a
      // mailing list they joined.
      html: emailWrapper({
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:16px;font-weight:700;">${escapeHtml(alert.title)}</p>` +
          `<table style="border-collapse:collapse;font-size:14px;">${rows}</table>` +
          (link ? `<p style="margin:16px 0 0;"><a href="${link}">Open in the admin panel</a></p>` : ""),
      }),
      text: [alert.title, "", ...alert.details.map(([k, v]) => `${k}: ${v}`), ...(link ? ["", link] : [])].join("\n"),
    });
  } catch (err) {
    console.error(`[alerts] email for ${alert.kind} failed:`, err);
  }
}

/**
 * Why an alert did not go out, in the log.
 *
 * Every one of the checks below used to be a bare `return`. Between them they
 * are the whole reason an alert silently fails to arrive, and they left nothing
 * behind — so "I never got a Telegram for two new handicappers" could not be
 * answered from the logs at all, by anyone. Each now says which gate it was.
 */
function skipped(kind: AdminAlertKind, why: string): void {
  console.warn(`[alerts] no telegram for ${kind}: ${why}`);
}

async function sendAlertTelegram(alert: AdminAlert): Promise<void> {
  try {
    // Not a skip worth logging: this event is email-only by design.
    if (!carries(alert.kind, "telegram")) return;
    if (!(await enabled(alert.kind, "telegram"))) {
      return skipped(alert.kind, "switched off in Admin → Telegram");
    }
    if (!telegramConfigured()) {
      return skipped(alert.kind, "TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME not set");
    }
    const chatId = (await getSetting(ALERT_CHAT_KEY))?.trim();
    if (!chatId) {
      return skipped(alert.kind, `no chat ID saved (setting ${ALERT_CHAT_KEY})`);
    }

    const link = alert.path ? `${siteUrl()}${alert.path}` : null;
    const text = [
      `<b>${escapeHtml(alert.title)}</b>`,
      ...alert.details.map(([k, v]) => `${escapeHtml(k)}: <b>${escapeHtml(v)}</b>`),
      ...(link ? ["", link] : []),
    ].join("\n");

    const sent = await sendTelegram(chatId, text);
    if (!sent.ok) {
      console.error(`[alerts] telegram for ${alert.kind} refused by Telegram: ${sent.error}`);
    }
  } catch (err) {
    console.error(`[alerts] telegram for ${alert.kind} failed:`, err);
  }
}
