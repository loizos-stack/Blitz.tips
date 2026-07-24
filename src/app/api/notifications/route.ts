import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Recent notifications + unread count for the bell.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ notifications: [], unread: 0 });

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unread });
}

// Mark notifications read: { all: true } or { id }.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const now = new Date();

  if (body.all) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: now },
    });
  } else if (typeof body.id === "string") {
    await prisma.notification.updateMany({
      where: { id: body.id, userId: session.user.id, readAt: null },
      data: { readAt: now },
    });
  } else {
    return NextResponse.json({ error: "Nothing to mark" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
