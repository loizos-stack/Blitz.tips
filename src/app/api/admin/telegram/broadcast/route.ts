import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import {
  TELEGRAM_CAPTION_LIMIT,
  TELEGRAM_TEXT_LIMIT,
  broadcastMedia,
  broadcastText,
  getTelegramChat,
  telegramConfigured,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Post to a Telegram channel through the bot.
 *
 * Sending to a channel is public and effectively irreversible — Telegram lets a
 * bot delete its own message only within 48 hours, and subscribers are notified
 * immediately either way. So this validates hard before it posts, and records
 * every attempt including the failures: a broadcast that didn't land is the
 * thing you most need to see in the history.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("telegram");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  if (!telegramConfigured()) {
    return NextResponse.json(
      { error: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME to broadcast." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  // @handle or a numeric id (channels are negative). Anything else is a typo,
  // and a typo here posts to someone else's chat.
  if (!/^(@[A-Za-z][A-Za-z0-9_]{4,31}|-?\d{5,})$/.test(chatId)) {
    return NextResponse.json(
      { error: "Channel must be an @handle or a numeric chat id" },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Post text is required" }, { status: 400 });

  const asset = body.asset ? basename(String(body.asset)) : null;
  if (asset && !/\.(png|mp4)$/.test(asset)) {
    return NextResponse.json({ error: "Attachment must be a .png or .mp4 from the marketing set" }, { status: 400 });
  }

  // Telegram caps a media caption at 1024 characters but a plain message at
  // 4096. Over the limit the whole post is refused, so check the one that
  // actually applies rather than the larger of the two.
  const limit = asset ? TELEGRAM_CAPTION_LIMIT : TELEGRAM_TEXT_LIMIT;
  if (text.length > limit) {
    return NextResponse.json(
      {
        error: `${asset ? "With an attachment the caption" : "Post text"} is limited to ${limit} characters; this is ${text.length}.`,
      },
      { status: 400 }
    );
  }

  // Confirm the bot can actually see the chat before posting. Catches the two
  // common setups — bot not added, or added without post rights — with
  // Telegram's own wording rather than a silent no-op.
  const chat = await getTelegramChat(chatId);
  if (!chat.ok) {
    return NextResponse.json(
      { error: `Telegram won't return that chat: ${chat.error}. Add the bot as an administrator with "post messages".` },
      { status: 400 }
    );
  }

  let result;
  if (asset) {
    let bytes: Buffer;
    try {
      bytes = await readFile(join(process.cwd(), "public/marketing", asset));
    } catch {
      return NextResponse.json({ error: `No such marketing asset: ${asset}` }, { status: 400 });
    }
    result = await broadcastMedia(chatId, bytes, asset, text);
  } else {
    result = await broadcastText(chatId, text);
  }

  // Recorded whether or not it worked.
  await prisma.telegramBroadcast.create({
    data: {
      chatId,
      chatTitle: chat.title,
      text,
      asset,
      messageId: result.messageId,
      ok: result.ok,
      error: result.error,
      sentById: ctx.userId,
      sentByEmail: ctx.email,
    },
  });

  await logAdmin(
    ctx.session,
    result.ok ? "telegram.broadcast" : "telegram.broadcast.failed",
    "TelegramChannel",
    chatId,
    `${asset ?? "text only"} · ${result.ok ? `message ${result.messageId}` : result.error}`
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Telegram rejected the post" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId, chatTitle: chat.title });
}
