import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { sendVerificationCode } from "@/lib/verification";
import { logActivity } from "@/lib/audit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, username, email, password, country } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }
  const usernameTaken = await prisma.user.findUnique({ where: { username } });
  if (usernameTaken) {
    return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  try {
    user = await prisma.user.create({
      data: { name, username, email: normalizedEmail, passwordHash, country: country ?? null },
      select: { id: true, email: true, name: true },
    });
  } catch (e) {
    // Unique-constraint race on email or username between the checks and create.
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "That email or username is already taken" }, { status: 409 });
    }
    throw e;
  }

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "user.register",
    targetType: "User",
    targetId: user.id,
    detail: "New account registered",
  });

  // Best-effort: a verification email failure shouldn't block registration.
  // Onboarding verifies with a 6-digit code entered on-screen.
  await sendVerificationCode(normalizedEmail).catch((e) =>
    console.error("Failed to send verification code:", e)
  );

  return NextResponse.json({ user }, { status: 201 });
}
