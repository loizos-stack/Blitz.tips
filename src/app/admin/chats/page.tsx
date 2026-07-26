import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { AGENT_ONLINE_WINDOW_MS } from "@/lib/chatbot";
import { ChatsManager } from "@/components/admin/chats-manager";

export const dynamic = "force-dynamic";

// Data loading lives outside the component so the per-request wall-clock read
// doesn't trip the render-purity lint (see admin/page.tsx for the same pattern).
async function loadChats() {
  const chats = await prisma.chat.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const cutoff = new Date(Date.now() - AGENT_ONLINE_WINDOW_MS);
  const onlineAgents = await prisma.agentPresence.count({ where: { lastSeen: { gt: cutoff } } });

  const data = chats.map((c) => ({
    id: c.id,
    visitorName: c.visitorName,
    visitorEmail: c.visitorEmail,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messages: c.messages.map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  return { data, onlineAgents };
}

export default async function AdminChatsPage() {
  await guardAdminPage("chat");
  const { data, onlineAgents } = await loadChats();
  return <ChatsManager initialChats={data} onlineAgents={onlineAgents} />;
}
