import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validations";
import { verifyTelegramAuth, telegramLoginConfigured } from "@/lib/telegram-login";
import { sendVerificationCode } from "@/lib/verification";
import { logActivity } from "@/lib/audit";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";
import { REFERRAL_COOKIE, resolveReferrer } from "@/lib/referrals";

/**
 * Creates an account from a verified Telegram identity plus the one thing
 * Telegram never provides: an email address.
 *
 * The whole app is built on having one — verification, Stripe customers,
 * receipts, digests, password reset — and `User.email` is a required unique
 * column, so there is no such thing here as an account without one. Rather than
 * loosen that for a single sign-up route, this collects the address up front and
 * the resulting account is identical to any other.
 *
 * No server-side state carries over from the widget callback: the payload is
 * self-authenticating, so it is simply re-verified here. That is what
 * MAX_AUTH_AGE_MS bounds — a captured payload stops working shortly after it
 * was issued.
 */
const bodySchema = z.object({
  telegram: z.unknown(),
  email: z.email("Enter a valid email"),
  username: usernameSchema,
  name: z.string().min(2, "Name is too short").max(60).optional(),
  country: z.string().min(2).max(60).optional(),
});

export async function POST(request: Request) {
  const limit = await rateLimit(`tg-login-complete:${clientIp(request)}`, 10, 3600);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  if (!telegramLoginConfigured()) {
    return NextResponse.json({ error: "Telegram sign-in isn't available." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const identity = verifyTelegramAuth(parsed.data.telegram);
  if (!identity) {
    return NextResponse.json(
      { error: "That Telegram sign-in has expired. Please start again." },
      { status: 401 }
    );
  }

  const { username, country } = parsed.data;
  const normalizedEmail = parsed.data.email.toLowerCase();
  // Telegram's own display name unless they typed one, and never empty: `name`
  // is what the rest of the site addresses them by.
  const name = parsed.data.name?.trim() || identity.name || `@${username}`;

  // Re-checked rather than trusted from /check: that response is advisory, and
  // the account could have been created by another tab in between.
  const alreadyLinked = await prisma.user.findFirst({
    where: { telegramChatId: identity.telegramId },
    select: { id: true },
  });
  if (alreadyLinked) {
    return NextResponse.json(
      { error: "That Telegram account is already linked to an account. Sign in instead." },
      { status: 409 }
    );
  }

  if (await prisma.user.findUnique({ where: { email: normalizedEmail } })) {
    return NextResponse.json(
      { error: "An account with that email already exists. Sign in and link Telegram from your settings." },
      { status: 409 }
    );
  }
  if (await prisma.user.findUnique({ where: { username } })) {
    return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  }

  const referralCookie = (await cookies()).get(REFERRAL_COOKIE)?.value;
  const referredById = await resolveReferrer(referralCookie);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        username,
        email: normalizedEmail,
        // No passwordHash: this account signs in through Telegram. Setting a
        // password later goes through the ordinary reset-by-email flow.
        image: identity.photoUrl,
        country: country ?? null,
        telegramChatId: identity.telegramId,
        ...(referredById ? { referredById, referredAt: new Date() } : {}),
      },
      select: { id: true, email: true, name: true },
    });
  } catch (e) {
    // Unique-constraint race between the checks above and this create.
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
    detail: "New account registered via Telegram",
  });

  // The email is unverified until they enter the code, exactly as with an
  // email/password signup — Telegram vouches for the Telegram account, not for
  // an address they typed into our form.
  await sendVerificationCode(normalizedEmail).catch((e) =>
    console.error("Failed to send verification code:", e)
  );

  const res = NextResponse.json({ user }, { status: 201 });
  if (referralCookie) res.cookies.delete(REFERRAL_COOKIE);
  return res;
}
