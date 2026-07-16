import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/presence — heartbeat from an open admin Chat tab. Marks the
 * agent online so visitors can be offered live chat. The admin page pings this
 * every ~20s; a stale record simply ages out of the online window.
 */
export async function POST() {
  const ctx = await requirePermission("chat");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  await prisma.agentPresence.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, lastSeen: new Date() },
    update: { lastSeen: new Date() },
  });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/presence — the agent is going offline (tab closed / stepping
 * away). Best-effort; if it doesn't fire, presence ages out on its own.
 */
export async function DELETE() {
  const ctx = await requirePermission("chat");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  await prisma.agentPresence.deleteMany({ where: { userId: ctx.userId } });
  return NextResponse.json({ ok: true });
}
