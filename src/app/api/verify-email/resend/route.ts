import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/verification";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user?.email) return NextResponse.json({ error: "No email on file" }, { status: 400 });
  if (user.emailVerified) return NextResponse.json({ error: "Already verified" }, { status: 400 });

  try {
    await sendVerificationEmail(user.email);
  } catch (error) {
    console.error("Resend verification failed:", error);
    return NextResponse.json({ error: "Couldn't send email. Try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
