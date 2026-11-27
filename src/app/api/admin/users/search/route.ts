import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

/**
 * Find a person to email, by address, name or handle.
 *
 * Exists so the one-to-one composer sends to a user you PICKED rather than to
 * an address you typed. A mistyped address in a free-text field is a message
 * about someone's account delivered to a stranger, and there is no recalling
 * it; choosing from a list cannot do that.
 */
export async function GET(request: Request) {
  // Same key as the tab it serves: anyone who can already mail every user on
  // the site is not gaining reach by looking one of them up.
  if (!(await requirePermission("emails"))) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  // Two characters matches most of the table and is not a search. Returning
  // nothing is the honest answer to "I haven't told you who yet".
  if (q.length < 3) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { handicapper: { handle: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      notifyEmail: true,
      handicapper: { select: { handle: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      handle: u.handicapper?.handle ?? null,
      // Surfaced so the composer can warn before mailing someone who has opted
      // out of announcements, rather than quietly deciding for them.
      unsubscribed: !u.notifyEmail,
    })),
  });
}
