import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Mark alerts as seen, which is what clears the number on the nav tab.
 *
 * Deliberately an explicit action rather than something opening the page does.
 * The badge is the notification; clearing it by merely glancing at the tab
 * would lose an alert that arrived while the page happened to be open — and an
 * alert about a line that is about to move is exactly the one you cannot
 * afford to lose silently.
 *
 * `id` acknowledges one; omitting it acknowledges everything outstanding.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("props");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const now = new Date();

  const { count } = await prisma.propSignal.updateMany({
    where: {
      acknowledgedAt: null,
      ...(body?.id ? { id: body.id } : {}),
    },
    data: { acknowledgedAt: now },
  });

  return NextResponse.json({ ok: true, acknowledged: count });
}
