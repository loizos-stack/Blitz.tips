import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTelegramAuth, telegramLoginConfigured } from "@/lib/telegram-login";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

/**
 * Does this Telegram account already belong to someone here?
 *
 * The widget callback can mean either "sign me in" or "sign me up", and the
 * browser can't tell which — so it asks. Answering here rather than letting the
 * sign-in attempt fail is what makes the difference legible: a failed
 * signIn() reports only that it failed, which would show a returning user an
 * error and a new user nothing useful.
 *
 * Deliberately says nothing about *which* account, only whether one exists, and
 * only to someone holding a payload Telegram signed moments ago.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(`tg-login-check:${clientIp(request)}`, 20, 600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  if (!telegramLoginConfigured()) {
    return NextResponse.json({ error: "Telegram sign-in isn't available." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const identity = verifyTelegramAuth(body);
  if (!identity) {
    return NextResponse.json({ error: "That Telegram sign-in couldn't be verified." }, { status: 401 });
  }

  const existing = await prisma.user.findFirst({
    where: { telegramChatId: identity.telegramId },
    select: { id: true, suspendedAt: true },
  });

  if (existing?.suspendedAt) {
    return NextResponse.json({ error: "That account has been suspended." }, { status: 403 });
  }

  return NextResponse.json({
    status: existing ? "linked" : "new",
    // Prefills the signup form. Already verified, so it is Telegram's own data
    // rather than anything the browser supplied.
    suggested: existing ? null : { name: identity.name, username: identity.username },
  });
}
