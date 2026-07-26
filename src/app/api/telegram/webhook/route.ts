import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { telegramWebhookSecret, sendTelegram } from "@/lib/telegram";

// Public endpoint Telegram calls with bot updates. We only care about the
// "/start <token>" a user sends when they tap their connect deep link.
export async function POST(request: Request) {
  const secret = telegramWebhookSecret();
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    // Ignore unauthenticated calls quietly (200 so Telegram doesn't retry).
    return NextResponse.json({ ok: true });
  }

  const update = await request.json().catch(() => null);
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  const text: string = typeof msg?.text === "string" ? msg.text : "";

  if (chatId && text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (token) {
      const user = await prisma.user.findUnique({ where: { telegramLinkToken: token } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { telegramChatId: String(chatId), telegramLinkToken: null },
        });
        await sendTelegram(
          String(chatId),
          "✅ Connected! You'll get a message here when a handicapper you follow or subscribe to posts a new pick."
        );
      } else {
        await sendTelegram(
          String(chatId),
          "That link has expired. Open Blitz.tips → notification settings and tap Connect Telegram again."
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
