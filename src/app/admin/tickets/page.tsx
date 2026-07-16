import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { TicketsManager } from "@/components/admin/tickets-manager";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  await guardAdminPage("tickets");

  const tickets = await prisma.ticket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  // Serialize dates for the client component.
  const data = tickets.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    messages: t.messages.map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  return <TicketsManager initialTickets={data} />;
}
