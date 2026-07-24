import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { telegramConfigured, telegramBotUsername } from "@/lib/telegram";

// Mint a one-time link token and return the Telegram deep link the user taps to
// connect. Opening it sends "/start <token>" to our bot, which our webhook maps
// back to this account.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!telegramConfigured()) return NextResponse.json({ error: "Telegram is not configured" }, { status: 400 });

  const token = randomBytes(16).toString("hex");
  await prisma.user.update({ where: { id: session.user.id }, data: { telegramLinkToken: token } });

  return NextResponse.json({ url: `https://t.me/${telegramBotUsername()}?start=${token}` });
}
