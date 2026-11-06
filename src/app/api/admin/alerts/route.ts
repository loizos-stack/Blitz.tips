import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { getSetting, setSetting } from "@/lib/settings";
import { ALERT_CHAT_KEY, ALERT_KINDS, notifyAdmins } from "@/lib/admin-alerts";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

/** Every settings key this endpoint is allowed to write. */
const TOGGLE_KEYS = new Set(
  ALERT_KINDS.flatMap((k) => k.channels.map((c) => `alerts.${k.key}.${c}`))
);

export async function POST(request: Request) {
  const ctx = await requirePermission("telegram");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "chatId") {
    // Telegram chat ids are numeric, negative for groups and channels. Stored
    // as text because a channel id overflows a 32-bit int and the only thing
    // we do with it is put it back in a URL.
    const raw = String(body.value ?? "").trim();
    if (raw && !/^-?\d{1,20}$/.test(raw)) {
      return NextResponse.json(
        { error: "That doesn't look like a chat ID. It's a number — negative for a group or channel." },
        { status: 400 }
      );
    }
    await setSetting(ALERT_CHAT_KEY, raw);
    await logAdmin(ctx.session, "alerts.chatId", "SiteSetting", ALERT_CHAT_KEY, raw || "cleared");
    return NextResponse.json({ ok: true, chatId: raw || null });
  }

  if (action === "toggle") {
    const key = String(body.key ?? "");
    if (!TOGGLE_KEYS.has(key)) {
      return NextResponse.json({ error: "Unknown alert." }, { status: 400 });
    }
    const on = body.value === true;
    await setSetting(key, on ? "true" : "false");
    await logAdmin(ctx.session, "alerts.toggle", "SiteSetting", key, on ? "on" : "off");
    return NextResponse.json({ ok: true });
  }

  // Proving the chat ID is right without waiting for a real signup — which is
  // the only other way to find out, and finding out that way means having
  // already missed one.
  if (action === "test") {
    if (!telegramConfigured()) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME aren't set." },
        { status: 400 }
      );
    }
    const chatId = (await getSetting(ALERT_CHAT_KEY))?.trim();
    if (!chatId) return NextResponse.json({ error: "Set a chat ID first." }, { status: 400 });

    const sent = await sendTelegram(
      chatId,
      "<b>Blitz.tips alerts</b>\nThis is a test. If you can read it, alerts will reach you here."
    );
    if (sent.gone) {
      return NextResponse.json(
        { error: "Telegram refused: the bot is blocked, or it isn't in that chat." },
        { status: 400 }
      );
    }
    // Only a 403 used to be treated as failure, so a mistyped chat ID — which
    // Telegram rejects with 400 "chat not found" — reported "Sent." A test that
    // passes when nothing was delivered is worse than having no test at all:
    // it is why two handicapper signups went unnoticed.
    if (!sent.ok) {
      return NextResponse.json(
        { error: `Telegram rejected it: ${sent.error}. Check the chat ID.` },
        { status: 400 }
      );
    }
    await logAdmin(ctx.session, "alerts.test", "SiteSetting", ALERT_CHAT_KEY, chatId);
    return NextResponse.json({
      ok: true,
      detail: "Telegram accepted it — it should be in that chat now.",
    });
  }

  // End-to-end rather than a bare Telegram send: this goes through the same
  // path a real signup takes, so it also proves the email side and the toggles.
  if (action === "preview") {
    await notifyAdmins({
      kind: "signup.subscriber",
      title: "Test alert — new customer registered",
      details: [
        ["Name", "Test Person"],
        ["Email", "test@example.com"],
      ],
      path: "/admin/users",
    });
    await logAdmin(ctx.session, "alerts.preview", "SiteSetting", "alerts", "sent");
    return NextResponse.json({ ok: true, detail: "Sent through the real alert path." });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
