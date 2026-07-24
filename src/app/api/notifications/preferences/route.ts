import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Read the current user's channel opt-outs.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ notifyEmail: true, notifyPush: true });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifyEmail: true, notifyPush: true },
  });
  return NextResponse.json({ notifyEmail: user?.notifyEmail ?? true, notifyPush: user?.notifyPush ?? true });
}

// Update one or both channel opt-outs.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: {
    notifyEmail?: boolean;
    notifyPush?: boolean;
    notifyTelegram?: boolean;
    notifyDiscord?: boolean;
  } = {};
  if (typeof body.notifyEmail === "boolean") data.notifyEmail = body.notifyEmail;
  if (typeof body.notifyPush === "boolean") data.notifyPush = body.notifyPush;
  if (typeof body.notifyTelegram === "boolean") data.notifyTelegram = body.notifyTelegram;
  if (typeof body.notifyDiscord === "boolean") data.notifyDiscord = body.notifyDiscord;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data });
  return NextResponse.json({ ok: true, ...data });
}
