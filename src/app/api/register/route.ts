import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { sendVerificationCode } from "@/lib/verification";
import { logActivity } from "@/lib/audit";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { REFERRAL_COOKIE, resolveReferrer } from "@/lib/referrals";

export async function POST(request: Request) {
  // Cap signups per IP to blunt automated account spam.
  const limit = await rateLimit(`register:${clientIp(request)}`, 10, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

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

  // Who sent them, if anyone. Resolved before the create so attribution is
  // written in the same statement the account is — there's no window where a
  // user exists un-credited, and no second write that could fail on its own.
  // An unresolvable code credits nobody rather than failing the signup.
  const referralCookie = (await cookies()).get(REFERRAL_COOKIE)?.value;
  const referredById = await resolveReferrer(referralCookie);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        username,
        email: normalizedEmail,
        passwordHash,
        country: country ?? null,
        ...(referredById ? { referredById, referredAt: new Date() } : {}),
      },
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

  const res = NextResponse.json({ user }, { status: 201 });
  // Spent. Leaving it would credit the same referrer for the next person who
  // signs up on a shared browser.
  if (referralCookie) res.cookies.delete(REFERRAL_COOKIE);
  return res;
}
