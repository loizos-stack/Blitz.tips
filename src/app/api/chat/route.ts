import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botReply, agentsOnline, type ChatTurn } from "@/lib/chatbot";
import type { ChatMessage } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_MESSAGE = 2000;

function serialize(m: ChatMessage) {
  return { id: m.id, author: m.author, body: m.body, createdAt: m.createdAt.toISOString() };
}

/**
 * GET /api/chat?chatId=&token=&after=ISO
 * Poll a chat for its status and any messages newer than `after`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId");
  const token = url.searchParams.get("token");
  const after = url.searchParams.get("after");
  if (!chatId || !token) return NextResponse.json({ error: "Missing chat" }, { status: 400 });

  const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { token: true, status: true } });
  if (!chat || chat.token !== token) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const afterDate = after ? new Date(after) : null;
  const messages = await prisma.chatMessage.findMany({
    where: { chatId, ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({
    status: chat.status,
    agentOnline: await agentsOnline(),
    messages: messages.map(serialize),
  });
}

/**
 * POST /api/chat — send a visitor message.
 * Body: { chatId?, token?, message }. With no chatId a new chat is created.
 * While the chat is in BOT mode the assistant replies inline; once it's WAITING
 * or LIVE the message is just stored for the agent.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (message.length > MAX_MESSAGE) return NextResponse.json({ error: "Message too long" }, { status: 400 });

  const chatId = typeof body.chatId === "string" ? body.chatId : null;
  const token = typeof body.token === "string" ? body.token : null;

  // Resolve or create the chat.
  let chat: { id: string; token: string; status: "BOT" | "WAITING" | "LIVE" | "CLOSED" };
  if (chatId && token) {
    const existing = await prisma.chat.findUnique({ where: { id: chatId }, select: { id: true, token: true, status: true } });
    if (!existing || existing.token !== token) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    chat = existing;
  } else {
    const created = await prisma.chat.create({ data: {}, select: { id: true, token: true, status: true } });
    chat = created;
  }

  // Store the visitor's message; a reply reopens a chat the agent had closed.
  const visitorMsg = await prisma.chatMessage.create({
    data: { chatId: chat.id, author: "VISITOR", body: message },
  });
  await prisma.chat.update({
    where: { id: chat.id },
    data: { updatedAt: new Date(), ...(chat.status === "CLOSED" ? { status: "BOT" } : {}) },
  });

  const created: ReturnType<typeof serialize>[] = [serialize(visitorMsg)];

  // Only the bot answers while in BOT mode (or a reopened chat). A LIVE/WAITING
  // chat is handled by a human, so we don't inject a bot reply.
  const effectiveStatus = chat.status === "CLOSED" ? "BOT" : chat.status;
  if (effectiveStatus === "BOT") {
    const history = await prisma.chatMessage.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    });
    const reply = await botReply(history.map((m): ChatTurn => ({ author: m.author, body: m.body })));
    const botMsg = await prisma.chatMessage.create({
      data: { chatId: chat.id, author: "BOT", body: reply },
    });
    created.push(serialize(botMsg));
  }

  return NextResponse.json({
    chatId: chat.id,
    token: chat.token,
    status: effectiveStatus,
    messages: created,
  });
}
