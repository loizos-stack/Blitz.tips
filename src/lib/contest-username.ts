import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * The contest publishes the name you enter under: it appears on the standings,
 * on a public entrant page, and on anything anyone shares from it.
 *
 * Every one of those surfaces falls back to `User.name` when there's no
 * username, and for a Google signup `name` is whatever Google holds — usually a
 * real full name. Entering a public handicapping contest shouldn't quietly
 * publish that, so a username is required at the point the name becomes public
 * rather than at signup, where it would interrupt people just browsing.
 *
 * Returns a 403 response to hand straight back, or null when the user is clear.
 * `needsUsername` lets the client show the inline claim form instead of a dead
 * error message.
 */
export async function requireContestUsername(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });

  if (user?.username) return null;

  return NextResponse.json(
    {
      error: "Choose a username first — it's the name you'll appear under on the leaderboard.",
      needsUsername: true,
    },
    { status: 403 }
  );
}
