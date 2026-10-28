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

export interface TelegramDmResult {
  /** Telegram accepted the message. */
  ok: boolean;
  /** The bot is blocked by this recipient; callers should drop the stored link. */
  gone: boolean;
  /** Telegram's own description of the refusal, when there was one. */
  error: string | null;
}

/**
 * Send a Telegram message.
 *
 * This used to answer `{gone: res.status === 403}` and nothing else, which
 * meant it reported success for every other refusal — a mistyped chat ID, a
 * bot that had never been spoken to, a group it had been removed from. Telegram
 * answers those with 400 and a precise description, and all of it was thrown
 * away: no return value, no log. An admin alert that never arrived left not one
 * trace anywhere, and the "Send a test" button said "Sent."
 *
 * So the body is parsed and the description comes back, and a refusal is logged
 * here rather than at each call site, because almost every caller is right not
 * to act on a failed DM — and "nothing to act on" must not keep meaning
 * "nothing to see".
 *
 * Still never throws: the callers are payment webhooks and signups where an
 * alert must not be what breaks the real work.
 *
 * Deadline for the same reason the broadcast calls below have one, which this
 * one was missing: a slow api.telegram.org would otherwise hold the caller
 * open until the platform kills it. That caller is now sometimes a payment
 * webhook, where a hang means Stripe gets no 200 and retries the event.
 */
export async function sendTelegram(chatId: string, text: string): Promise<TelegramDmResult> {
  if (!token) return { ok: false, gone: false, error: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as TelegramApiResponse | null;
    // 403 = bot blocked by the user; caller should drop the link.
    const gone = res.status === 403;
    if (!res.ok || !json?.ok) {
      const error = apiError(json, res.status);
      // A block is an ordinary outcome the caller handles; anything else is a
      // misconfiguration somebody needs to see.
      if (!gone) console.error(`[telegram] sendMessage to ${chatId} refused: ${error}`);
      return { ok: false, gone, error };
    }
    return { ok: true, gone: false, error: null };
  } catch (e) {
    const error = isTimeout(e)
      ? `Telegram didn't answer within ${TEXT_TIMEOUT_MS / 1000}s`
      : "Couldn't reach Telegram";
    console.error(`[telegram] sendMessage to ${chatId} failed: ${error}`);
    return { ok: false, gone: false, error };
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
 * These also return the failure to the caller to show on screen, since a
 * broadcast that fails is the post you thought went out, whereas a failed DM is
 * one lost notification that only needs logging.
 */

/**
 * Per-call deadlines. Without one, an unreachable or slow api.telegram.org
 * leaves the request hanging until the platform kills the function, and a
 * killed function returns a gateway error page rather than anything readable —
 * the caller sees "bad gateway" and has no idea Telegram was the problem.
 * A timeout turns that into a fast, specific failure.
 */
const CHECK_TIMEOUT_MS = 10_000;
const TEXT_TIMEOUT_MS = 15_000;
const MEDIA_TIMEOUT_MS = 45_000;

/** True when a fetch rejection was our own deadline rather than a network fault. */
function isTimeout(e: unknown): boolean {
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

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
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as
      | (TelegramApiResponse & { result?: { title?: string; username?: string } })
      | null;
    if (!res.ok || !json?.ok) return { ok: false, title: null, error: apiError(json, res.status) };
    return { ok: true, title: json.result?.title ?? json.result?.username ?? null, error: null };
  } catch (e) {
    return {
      ok: false,
      title: null,
      error: isTimeout(e)
        ? `Telegram didn't answer within ${CHECK_TIMEOUT_MS / 1000}s — the API may be unreachable from the server.`
        : "Couldn't reach Telegram",
    };
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
      signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as TelegramApiResponse | null;
    if (!res.ok || !json?.ok) return { ok: false, messageId: null, error: apiError(json, res.status) };
    return { ok: true, messageId: String(json.result?.message_id ?? ""), error: null };
  } catch (e) {
    return {
      ok: false,
      messageId: null,
      error: isTimeout(e)
        ? `Telegram didn't answer within ${TEXT_TIMEOUT_MS / 1000}s — the API may be unreachable from the server.`
        : "Couldn't reach Telegram",
    };
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
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as TelegramApiResponse | null;
    if (!res.ok || !json?.ok) return { ok: false, messageId: null, error: apiError(json, res.status) };
    return { ok: true, messageId: String(json.result?.message_id ?? ""), error: null };
  } catch (e) {
    return {
      ok: false,
      messageId: null,
      error: isTimeout(e)
        ? `Upload didn't finish within ${MEDIA_TIMEOUT_MS / 1000}s — try a smaller file or a text-only post.`
        : "Couldn't reach Telegram",
    };
  }
}
