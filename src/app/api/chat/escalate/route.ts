import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agentsOnline } from "@/lib/chatbot";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/escalate — the visitor asked to talk to a human.
 * Body: { chatId, token }.
 *
 * If an agent is online the chat moves to WAITING and a system note is added, so
 * the admin Chat tab surfaces it for someone to claim. If nobody is online we
 * report `{ online: false }` and leave the chat as-is — the widget then shows a
 * contact form that opens a support ticket instead.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const chatId = typeof body.chatId === "string" ? body.chatId : null;
  const token = typeof body.token === "string" ? body.token : null;
  if (!chatId || !token) return NextResponse.json({ error: "Missing chat" }, { status: 400 });

  const chat = await prisma.chat.findUnique({ where: { id: chatId }, select: { token: true, status: true } });
  if (!chat || chat.token !== token) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const online = await agentsOnline();
  if (!online) {
    return NextResponse.json({ online: false });
  }

  // Already with a human — nothing to do.
  if (chat.status === "LIVE" || chat.status === "WAITING") {
    return NextResponse.json({ online: true, status: chat.status });
  }

  await prisma.chatMessage.create({
    data: {
      chatId,
      author: "SYSTEM",
      body: "Connecting you with the next available agent… Someone will be with you shortly.",
    },
  });
  await prisma.chat.update({ where: { id: chatId }, data: { status: "WAITING", updatedAt: new Date() } });

  return NextResponse.json({ online: true, status: "WAITING" });
}
