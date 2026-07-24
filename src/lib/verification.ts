import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  verificationEmailHtml,
  verificationEmailText,
  verificationCodeEmailHtml,
  verificationCodeEmailText,
} from "@/lib/email";
import { siteUrl } from "@/lib/site";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Short-code verification (signup onboarding). Codes are 6 digits, expire fast,
// and allow a handful of attempts before requiring a resend.
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 6;

/**
 * Generate a fresh 6-digit code for an email (replacing any prior one) and send
 * it. Best-effort on the send — the code still exists so the user can retry.
 */
export async function sendVerificationCode(email: string): Promise<void> {
  const identifier = email.toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = new Date(Date.now() + CODE_TTL_MS);

  await prisma.emailVerificationCode.upsert({
    where: { identifier },
    create: { identifier, code, expires, attempts: 0 },
    update: { code, expires, attempts: 0 },
  });

  if (!process.env.RESEND_API_KEY) {
    console.log(`[verify-code] ${identifier} → ${code}`);
  }

  await sendEmail({
    to: identifier,
    subject: "Your Blitz.tips verification code",
    html: verificationCodeEmailHtml(code),
    text: verificationCodeEmailText(code),
  });
}

type CodeResult = "verified" | "already" | "invalid" | "expired" | "too_many";

/**
 * Check a submitted code against the stored one for an email. On success marks
 * the user verified and clears the code; tracks attempts to throttle guessing.
 */
export async function verifyEmailCode(email: string, code: string): Promise<CodeResult> {
  const identifier = email.toLowerCase();
  const submitted = code.trim();
  if (!/^\d{6}$/.test(submitted)) return "invalid";

  const user = await prisma.user.findUnique({ where: { email: identifier } });
  if (user?.emailVerified) return "already";

  const record = await prisma.emailVerificationCode.findUnique({ where: { identifier } });
  if (!record) return "invalid";

  if (record.expires < new Date()) {
    await prisma.emailVerificationCode.delete({ where: { identifier } }).catch(() => undefined);
    return "expired";
  }
  if (record.attempts >= CODE_MAX_ATTEMPTS) return "too_many";

  if (record.code !== submitted) {
    await prisma.emailVerificationCode.update({
      where: { identifier },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  }
  await prisma.emailVerificationCode.delete({ where: { identifier } }).catch(() => undefined);
  return "verified";
}

/**
 * Create a fresh email-verification token for an address (replacing any prior
 * ones) and email the verification link. Best-effort on the send: if email
 * isn't configured or fails, the token still exists so the user can retry.
 */
export async function sendVerificationEmail(email: string): Promise<void> {
  const identifier = email.toLowerCase();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({ data: { identifier, token, expires } });

  const url = `${siteUrl()}/verify-email?token=${token}`;

  // Without an email provider configured, surface the link in logs so local
  // dev can still complete verification.
  if (!process.env.RESEND_API_KEY) {
    console.log(`[verify] ${identifier} → ${url}`);
  }

  await sendEmail({
    to: identifier,
    subject: "Verify your email · Blitz.tips",
    html: verificationEmailHtml(url),
    text: verificationEmailText(url),
  });
}

/** Whether a user has confirmed their email — gates sensitive actions. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return Boolean(user?.emailVerified);
}

type VerifyResult = "verified" | "already" | "invalid" | "expired";

/**
 * Consume a verification token: mark the matching user verified and delete the
 * token. Returns a status for the result page to render.
 */
export async function consumeVerificationToken(token: string): Promise<VerifyResult> {
  if (!token) return "invalid";

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return "invalid";

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
    return "expired";
  }

  const user = await prisma.user.findUnique({ where: { email: record.identifier } });
  await prisma.verificationToken.delete({ where: { token } }).catch(() => undefined);
  if (!user) return "invalid";
  if (user.emailVerified) return "already";

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return "verified";
}
