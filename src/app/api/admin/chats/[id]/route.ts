import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET — poll a single chat's status and any messages newer than `after` so the
// admin Chat tab stays live without a full page reload.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("chat");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const chat = await prisma.chat.findUnique({ where: { id }, select: { status: true } });
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const after = new URL(request.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  const messages = await prisma.chatMessage.findMany({
    where: { chatId: id, ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({
    status: chat.status,
    messages: messages.map((m) => ({ id: m.id, author: m.author, body: m.body, createdAt: m.createdAt.toISOString() })),
  });
}

// Agent actions on a live chat: reply, claim (take over from the bot), close,
// or reopen. Replying implicitly claims the chat and puts it into LIVE mode.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("chat");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const chat = await prisma.chat.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "reply") {
    const reply = typeof body.body === "string" ? body.body.trim() : "";
    if (!reply || reply.length > 4000) return NextResponse.json({ error: "Enter a reply" }, { status: 400 });

    await prisma.chatMessage.create({ data: { chatId: id, author: "AGENT", body: reply } });
    // Replying takes ownership and moves the chat live.
    await prisma.chat.update({ where: { id }, data: { status: "LIVE", agentId: ctx.userId, updatedAt: new Date() } });
    await logAdmin(ctx.session, "chat.reply", "Chat", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "claim") {
    await prisma.chat.update({ where: { id }, data: { status: "LIVE", agentId: ctx.userId, updatedAt: new Date() } });
    await prisma.chatMessage.create({
      data: { chatId: id, author: "SYSTEM", body: "An agent has joined the chat." },
    });
    await logAdmin(ctx.session, "chat.claim", "Chat", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "close" || action === "reopen") {
    const status = action === "close" ? "CLOSED" : "LIVE";
    await prisma.chat.update({ where: { id }, data: { status, updatedAt: new Date() } });
    if (action === "close") {
      await prisma.chatMessage.create({
        data: { chatId: id, author: "SYSTEM", body: "This chat has been closed. Send a message to reopen it." },
      });
    }
    await logAdmin(ctx.session, `chat.${action}`, "Chat", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("chat");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const chat = await prisma.chat.findUnique({ where: { id }, select: { id: true } });
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  await prisma.chat.delete({ where: { id } });
  await logAdmin(ctx.session, "chat.delete", "Chat", id);
  return NextResponse.json({ ok: true });
}
