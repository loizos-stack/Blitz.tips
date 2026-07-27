import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validations";

/**
 * Claim a username for the signed-in account.
 *
 * Separate from the onboarding basics endpoint (/api/account/country), which
 * demands a country in the same request — fine during onboarding, wrong here,
 * where the only thing standing between someone and the contest is a handle.
 *
 * Usernames are immutable once set, so this only ever fills a blank. That's
 * deliberate: the leaderboard, entrant URLs and shared pick cards all key off
 * the username, and letting it change would rewrite someone's public history.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });
  if (!current) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (current.username) {
    return NextResponse.json({ error: "You already have a username." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = usernameSchema.safeParse(body?.username);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Choose a valid username" },
      { status: 400 }
    );
  }

  const taken = await prisma.user.findUnique({ where: { username: parsed.data } });
  if (taken) return NextResponse.json({ error: "That username is taken" }, { status: 409 });

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { username: parsed.data } });
  } catch (e) {
    // Someone claimed it between the check and the write.
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ username: parsed.data });
}
