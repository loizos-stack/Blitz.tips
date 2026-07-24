import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyEmailCode } from "@/lib/verification";

// Verify the 6-digit code for the signed-in user's email (signup onboarding).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (!user?.email) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const result = await verifyEmailCode(user.email, code);
  if (result === "verified" || result === "already") {
    return NextResponse.json({ ok: true });
  }
  const message = {
    invalid: "That code isn't right. Check the digits and try again.",
    expired: "That code expired. Resend a new one.",
    too_many: "Too many attempts. Resend a new code.",
  }[result];
  return NextResponse.json({ error: message }, { status: 400 });
}
