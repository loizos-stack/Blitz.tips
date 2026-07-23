import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isEmailVerified } from "@/lib/verification";
import { clientMeta } from "@/lib/request-meta";
import { logActivity } from "@/lib/audit";

// Join a contest. Open to any signed-in, email-verified user. Idempotent — the
// unique (contestId, userId) constraint means a double-tap just returns the
// existing entry.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to enter" }, { status: 401 });

  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json({ error: "Please verify your email before entering." }, { status: 403 });
  }

  const { id } = await params;
  const contest = await prisma.contest.findUnique({ where: { id } });
  if (!contest) return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  if (contest.status !== "OPEN") {
    return NextResponse.json({ error: "This contest isn't open for entries." }, { status: 400 });
  }
  if (new Date() > contest.endsAt) {
    return NextResponse.json({ error: "This contest has already ended." }, { status: 400 });
  }

  const entry = await prisma.contestEntry.upsert({
    where: { contestId_userId: { contestId: id, userId: session.user.id } },
    create: { contestId: id, userId: session.user.id },
    update: {},
  });

  // Anti-fraud signal: record the IP + device used to enter (best-effort).
  const { ip, userAgent } = clientMeta(request);
  if (ip) {
    await prisma.contestIpLog
      .create({ data: { contestId: id, entryId: entry.id, userId: session.user.id, ip, userAgent, action: "join" } })
      .catch(() => undefined);
  }

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "contest.join",
    targetType: "Contest",
    targetId: id,
    detail: contest.name,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
