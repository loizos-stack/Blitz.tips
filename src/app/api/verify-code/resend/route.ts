import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/verification";

// Resend a fresh verification code to the signed-in user's email.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user?.email) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true });

  await sendVerificationCode(user.email).catch((e) => console.error("Resend code failed:", e));
  return NextResponse.json({ ok: true });
}
