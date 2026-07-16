import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { emailWrapper, escapeHtml } from "@/lib/email-template";
import { ticketReplyAddress } from "@/lib/tickets";

// Reply to a ticket (adds an admin message + emails the customer) or reopen /
// close it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tickets");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "reply") {
    const reply = typeof body.body === "string" ? body.body.trim() : "";
    if (!reply || reply.length > 8000) {
      return NextResponse.json({ error: "Enter a reply" }, { status: 400 });
    }

    await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, author: "ADMIN", body: reply },
    });
    // Answering reopens a closed ticket and bumps its updated time.
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN", updatedAt: new Date() } });

    const ref = ticket.id.slice(-8).toUpperCase();
    after(async () => {
      const html = emailWrapper({
        preheader: `Reply from the Blitz.tips team (ticket #${ref})`,
        bodyHtml: `
          <h1 style="font-size:20px;margin:0 0 4px;color:#13161c;">Reply from the Blitz.tips team</h1>
          <p style="margin:0 0 16px;color:#9ca3af;font-size:13px;">Ticket #${ref}${ticket.subject ? ` &middot; ${escapeHtml(ticket.subject)}` : ""}</p>
          <div style="white-space:pre-wrap;line-height:1.6;color:#374151;">${escapeHtml(reply)}</div>
          <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Reply to this email to continue the conversation.</p>
        `,
      });
      const text = [
        `Reply from the Blitz.tips team — ticket #${ref}`,
        "",
        reply,
        "",
        "Reply to this email to continue the conversation.",
      ].join("\n");
      await sendEmail({
        to: ticket.email,
        subject: `Re: ${ticket.subject || "Your Blitz.tips support ticket"} (#${ref})`,
        html,
        text,
        // Reply-to is the ticket's own address so the customer's reply threads
        // back into this ticket (falls back to support), not the no-reply From.
        replyTo: ticketReplyAddress(ticket.id),
      });
    });

    await logAdmin(ctx.session, "ticket.reply", "Ticket", ticket.id, `replied to ${ticket.email}`);
    return NextResponse.json({ ok: true });
  }

  if (action === "close" || action === "reopen") {
    const status = action === "close" ? "CLOSED" : "OPEN";
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status } });
    await logAdmin(ctx.session, `ticket.${action}`, "Ticket", ticket.id, ticket.email);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("tickets");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { email: true } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  await prisma.ticket.delete({ where: { id } });
  await logAdmin(ctx.session, "ticket.delete", "Ticket", id, ticket.email);
  return NextResponse.json({ ok: true });
}
