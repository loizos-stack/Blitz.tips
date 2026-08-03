import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPickLocked } from "@/lib/pick-visibility";
import { isSubscriptionActive } from "@/lib/subscription-status";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Tail or fade a pick.
 *
 * Body: `{ "tailed": true }` to back it, `false` to fade it, `null` to clear.
 *
 * Three rules the endpoint enforces rather than trusting the client for:
 *
 * 1. You can only tail a pick you can actually see. A locked premium pick's
 *    selection is exactly what a subscription buys, so tailing one would let a
 *    non-subscriber confirm a play exists — and, worse, the count itself would
 *    leak activity on picks they can't read.
 * 2. You can't tail a game that has already started. The whole claim is that a
 *    position was taken beforehand; a tail after kickoff is a bet on a result.
 * 3. You can't tail your own pick. A capper inflating their own social proof is
 *    the first thing anyone would try.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const limit = await rateLimit(`pick-tail:${session.user.id}`, 60, 60);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { tailed?: boolean | null } | null;
  if (!body || (body.tailed !== true && body.tailed !== false && body.tailed !== null)) {
    return NextResponse.json({ error: "tailed must be true, false, or null" }, { status: 400 });
  }

  const pick = await prisma.pick.findUnique({
    where: { id },
    select: {
      id: true,
      isPremium: true,
      result: true,
      eventStartsAt: true,
      handicapperId: true,
      handicapper: { select: { userId: true } },
    },
  });
  if (!pick) return NextResponse.json({ error: "Pick not found" }, { status: 404 });

  if (pick.handicapper.userId === session.user.id) {
    return NextResponse.json({ error: "You can't tail your own pick." }, { status: 403 });
  }

  if (pick.eventStartsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This game has already started — tailing closed at kickoff." },
      { status: 409 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      subscriberId_handicapperId: {
        subscriberId: session.user.id,
        handicapperId: pick.handicapperId,
      },
    },
  });
  if (isPickLocked(pick, isSubscriptionActive(subscription))) {
    return NextResponse.json(
      { error: "Subscribe to see this pick before you can tail it." },
      { status: 403 }
    );
  }

  if (body.tailed === null) {
    await prisma.pickTail
      .delete({ where: { pickId_userId: { pickId: id, userId: session.user.id } } })
      .catch(() => null); // already gone is the state they asked for
  } else {
    await prisma.pickTail.upsert({
      where: { pickId_userId: { pickId: id, userId: session.user.id } },
      create: { pickId: id, userId: session.user.id, tailed: body.tailed },
      update: { tailed: body.tailed },
    });
  }

  const [tails, fades] = await Promise.all([
    prisma.pickTail.count({ where: { pickId: id, tailed: true } }),
    prisma.pickTail.count({ where: { pickId: id, tailed: false } }),
  ]);

  return NextResponse.json({ tails, fades, mine: body.tailed });
}
