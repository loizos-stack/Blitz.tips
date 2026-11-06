import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { setSetting } from "@/lib/settings";
import { getTelegramChat, telegramConfigured } from "@/lib/telegram";
import { AUTOPOST_CHANNEL_KEY, AUTOPOST_ENABLED_KEY } from "@/lib/telegram-autopost";

export const dynamic = "force-dynamic";

/**
 * Configure auto-posting of free tips to the public channel.
 *
 * Turning it ON verifies the channel first. The alternative is discovering the
 * bot was never added when the next handicapper posts and the announcement
 * silently fails — the failure would be recorded, but nobody is watching the
 * broadcast history at that moment. Better to fail here, while someone is
 * looking at the screen.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("telegram");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled === true;
  const channel = typeof body.channel === "string" ? body.channel.trim() : "";

  if (enabled) {
    if (!telegramConfigured()) {
      return NextResponse.json(
        { error: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME before enabling auto-post." },
        { status: 503 }
      );
    }
    if (!/^(@[A-Za-z][A-Za-z0-9_]{4,31}|-?\d{5,})$/.test(channel)) {
      return NextResponse.json(
        { error: "Channel must be an @handle or a numeric chat id" },
        { status: 400 }
      );
    }
    const chat = await getTelegramChat(channel);
    if (!chat.ok) {
      return NextResponse.json(
        {
          error: `Can't enable: ${chat.error}. Add the bot as an administrator of that channel with "post messages" first.`,
        },
        { status: 400 }
      );
    }
  }

  await Promise.all([
    setSetting(AUTOPOST_ENABLED_KEY, enabled ? "1" : "0"),
    setSetting(AUTOPOST_CHANNEL_KEY, channel),
  ]);

  await logAdmin(
    ctx.session,
    enabled ? "telegram.autopost.enable" : "telegram.autopost.disable",
    "SiteSetting",
    AUTOPOST_ENABLED_KEY,
    enabled ? `free tips → ${channel}` : "off"
  );

  return NextResponse.json({ ok: true, enabled, channel });
}
