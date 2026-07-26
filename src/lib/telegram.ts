import "server-only";

// Telegram DM notifications are optional: without a bot token + username the
// channel is hidden and sending is a no-op.
const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
const username = process.env.TELEGRAM_BOT_USERNAME ?? "";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";

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
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
