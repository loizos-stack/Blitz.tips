import "server-only";

// Telegram DM notifications are optional: without a bot token + username the
// channel is hidden and sending is a no-op.
const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
const username = process.env.TELEGRAM_BOT_USERNAME ?? "";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

// Overridable so the broadcast path can be exercised against a stub instead of
// posting to a real channel — same escape hatch NOWPAYMENTS_API_BASE provides.
// Never set this in production: it is where the bot token gets sent.
const API_BASE = (process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org").replace(/\/+$/, "");

export function telegramConfigured(): boolean {
  return Boolean(token && username);
}

export function telegramBotUsername(): string {
  return username;
}

export function telegramWebhookSecret(): string {
  return webhookSecret;
}

/** Send a Telegram message. `gone: true` when the user has blocked the bot. */
export async function sendTelegram(chatId: string, text: string): Promise<{ gone: boolean }> {
  if (!token) return { gone: false };
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    // 403 = bot blocked by the user; caller should drop the link.
    return { gone: res.status === 403 };
  } catch {
    return { gone: false };
  }
}

// ---------------------------------------------------------- broadcasting ----

/**
 * Posting to a channel we own, as opposed to DMing a linked user.
 *
 * Telegram's paid ad platform (ads.telegram.org) has no public API — nothing
 * creates a campaign or returns its stats — so this is the only part of
 * Telegram promotion that can be automated. The bot must be an administrator of
 * the target channel with "post messages" permission; Telegram returns 400 with
 * a readable reason when it isn't.
 *
 * Unlike sendTelegram, these surface the failure. A DM that fails is one lost
 * notification; a broadcast that fails is the post you thought went out.
 */

export interface TelegramSendResult {
  ok: boolean;
  messageId: string | null;
  /** Telegram's own description, which is specific enough to act on. */
  error: string | null;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  result?: { message_id?: number };
}

function apiError(json: TelegramApiResponse | null, status: number): string {
  return json?.description || `Telegram returned ${status}`;
}

/** Channel title and type, used to confirm the bot can see the chat before posting. */
export async function getTelegramChat(
  chatId: string
): Promise<{ ok: boolean; title: string | null; error: string | null }> {
  if (!token) return { ok: false, title: null, error: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`${API_BASE}/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | (TelegramApiResponse & { result?: { title?: string; username?: string } })
      | null;
    if (!res.ok || !json?.ok) return { ok: false, title: null, error: apiError(json, res.status) };
    return { ok: true, title: json.result?.title ?? json.result?.username ?? null, error: null };
  } catch {
    return { ok: false, title: null, error: "Couldn't reach Telegram" };
  }
}

/** Post text to a channel. HTML parse mode, same as the DM path. */
export async function broadcastText(chatId: string, text: string): Promise<TelegramSendResult> {
  if (!token) return { ok: false, messageId: null, error: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false }),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as TelegramApiResponse | null;
    if (!res.ok || !json?.ok) return { ok: false, messageId: null, error: apiError(json, res.status) };
    return { ok: true, messageId: String(json.result?.message_id ?? ""), error: null };
  } catch {
    return { ok: false, messageId: null, error: "Couldn't reach Telegram" };
  }
}

/**
 * Post an image or video with a caption.
 *
 * sendPhoto for stills, sendVideo for mp4 — sending an mp4 through sendPhoto is
 * rejected, and sending a still through sendVideo produces a broken player.
 * Captions are capped at 1024 characters by Telegram (against 4096 for a plain
 * message), which the caller has to respect or the whole post is refused.
 */
export const TELEGRAM_CAPTION_LIMIT = 1024;
export const TELEGRAM_TEXT_LIMIT = 4096;

export async function broadcastMedia(
  chatId: string,
  bytes: Buffer,
  filename: string,
  caption: string
): Promise<TelegramSendResult> {
  if (!token) return { ok: false, messageId: null, error: "TELEGRAM_BOT_TOKEN is not set" };

  const isVideo = /\.(mp4|mov)$/i.test(filename);
  const method = isVideo ? "sendVideo" : "sendPhoto";
  const field = isVideo ? "video" : "photo";
  const mime = isVideo ? "video/mp4" : "image/png";

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append(field, new Blob([new Uint8Array(bytes)], { type: mime }), filename);

  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as TelegramApiResponse | null;
    if (!res.ok || !json?.ok) return { ok: false, messageId: null, error: apiError(json, res.status) };
    return { ok: true, messageId: String(json.result?.message_id ?? ""), error: null };
  } catch {
    return { ok: false, messageId: null, error: "Couldn't reach Telegram" };
  }
}
