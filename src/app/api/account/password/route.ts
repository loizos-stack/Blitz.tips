import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema } from "@/lib/validations";
import { logActivity } from "@/lib/audit";

// Change (or, for a Google-only account, set) the signed-in user's password.
// Available to every user, not just handicappers.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  // Accounts that already have a password must prove the current one; accounts
  // created via Google (no password yet) can set their first password freely.
  if (user.passwordHash) {
    const ok =
      typeof parsed.data.currentPassword === "string" &&
      (await bcrypt.compare(parsed.data.currentPassword, user.passwordHash));
    if (!ok) {
      return NextResponse.json({ error: "Your current password is incorrect" }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  await logActivity({
    actorId: session.user.id,
    actorEmail: user.email,
    action: "account.password_change",
    targetType: "User",
    targetId: session.user.id,
    detail: user.passwordHash ? "Changed password" : "Set a password",
  });

  return NextResponse.json({ ok: true });
}
