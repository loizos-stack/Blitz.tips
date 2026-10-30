import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { telegramWebhookSecret, sendTelegram } from "@/lib/telegram";

// Public endpoint Telegram calls with bot updates. Two things are handled: the
// "/start <token>" a user sends when they tap their connect deep link, and
// "/id", which answers with the chat's own ID.
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

  // Being added to a group: say the ID without being asked. This is the moment
  // someone is setting up alerts, and it saves them hunting for it.
  const added = update?.my_chat_member;
  if (added && isJoined(added) && isGroup(added.chat?.type)) {
    await sendTelegram(String(added.chat.id), chatIdReply(added.chat));
  }

  // "/id" in any private chat or group. Deliberately not answered in a
  // channel: a reply there is a post to every subscriber, and a channel is the
  // one place this ID should not be going anyway — admin alerts carry customer
  // emails and ticket text.
  if (chatId && /^\/id(@\w+)?\b/.test(text) && isAnswerable(msg.chat?.type)) {
    await sendTelegram(String(chatId), chatIdReply(msg.chat));
  }

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

type ChatInfo = { id: number | string; type?: string; title?: string };

const isGroup = (type?: string) => type === "group" || type === "supergroup";
const isAnswerable = (type?: string) => type === "private" || isGroup(type);

/**
 * Did this my_chat_member update mean "the bot is now in this chat"?
 *
 * Telegram sends one for every membership change, including being removed,
 * so the new status is what decides. "restricted" counts only when the bot is
 * still a member — a restricted non-member cannot post.
 */
function isJoined(u: { new_chat_member?: { status?: string; is_member?: boolean } }): boolean {
  const s = u.new_chat_member?.status;
  if (s === "member" || s === "administrator") return true;
  return s === "restricted" && u.new_chat_member?.is_member === true;
}

/**
 * The answer to "what is this chat's ID?".
 *
 * The ID goes in a <code> block because that is what makes Telegram clients
 * copy it on tap — this number gets pasted into the admin panel, and a
 * transcription slip produces exactly the "chat not found" that sent someone
 * looking for it in the first place.
 */
function chatIdReply(chat: ChatInfo): string {
  const name = chat.title ? ` (${escapeHtml(chat.title)})` : "";
  return (
    `This chat's ID${name} is:\n\n<code>${chat.id}</code>\n\n` +
    `Paste it into Blitz.tips → Admin → Telegram to send admin alerts here.`
  );
}

/** Telegram's HTML parse mode — a group title can contain any of these. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
